import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getNearbyQuests: vi.fn() }));
vi.mock("../../../../../modules/content/get-nearby-quests.server", () => mocks);

import { GET } from "./route";

const originId = "561a6218-3882-4db6-a0d4-0f70f7901101";

function request(query: string) {
  return new NextRequest(`http://localhost/api/v1/quests/nearby?${query}`);
}

beforeEach(() => {
  mocks.getNearbyQuests.mockReset();
});

it("returns an empty result for a known origin with no nearby quests", async () => {
  const origin = {
    id: originId,
    kind: "subway_exit",
    nameKo: "성수역 3번 출구",
    nameJa: "聖水駅3番出口",
    isSample: true,
  };
  mocks.getNearbyQuests.mockResolvedValue({ origin, quests: [] });
  const response = await GET(request(`originId=${originId}`));
  expect(response.status).toBe(200);
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(await response.json()).toEqual({ origin, radiusM: 800, quests: [] });
  expect(mocks.getNearbyQuests).toHaveBeenCalledWith({ originId, radiusM: 800, limit: 10 });
});

it("returns 404 for an unknown origin and accepts maximum search bounds", async () => {
  mocks.getNearbyQuests.mockResolvedValue(null);
  const response = await GET(request(`originId=${originId}&radiusM=2000&limit=20`));
  expect(response.status).toBe(404);
  expect(mocks.getNearbyQuests).toHaveBeenCalledWith({ originId, radiusM: 2000, limit: 20 });
});

it.each([
  "",
  "originId=invalid",
  `originId=${originId}&originId=${originId}`,
  `originId=${originId}&radiusM=1&radiusM=2`,
  `originId=${originId}&radiusM=0`,
  `originId=${originId}&radiusM=2001`,
  `originId=${originId}&limit=1.5`,
  `originId=${originId}&limit=21`,
  `originId=${originId}&other=1`,
])("rejects invalid input before querying the database (%s)", async (query) => {
  expect((await GET(request(query))).status).toBe(400);
  expect(mocks.getNearbyQuests).not.toHaveBeenCalled();
});
