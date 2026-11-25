import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sessionMocks = vi.hoisted(() => ({ verifyVisitorSession: vi.fn() }));
const reportMocks = vi.hoisted(() => ({ submitReport: vi.fn() }));

vi.mock("../../../../../../modules/session/visitor-session.server", () =>
  sessionMocks,
);
vi.mock("../../../../../../modules/feedback/submit-report.server", () =>
  reportMocks,
);

import { POST } from "./route";

const questId = "11111111-1111-4111-8111-111111111111";
const versionId = "22222222-2222-4222-8222-222222222222";
const clientRequestId = "77777777-7777-4777-8777-777777777777";
const validBody = {
  versionId,
  clientRequestId,
  category: "information",
  comment: "表示されている住所を確認できませんでした。",
};

function request(body: unknown = validBody, cookie = true) {
  const headers = new Headers({
    "content-type": "application/json",
    origin: "http://127.0.0.1:3000",
  });
  if (cookie) headers.set("cookie", "digiman_visitor=valid-token");
  return new NextRequest(
    `http://127.0.0.1:3000/api/v1/quests/${questId}/reports`,
    { method: "POST", headers, body: JSON.stringify(body) },
  );
}

const context = { params: Promise.resolve({ questId }) };

describe("POST /api/v1/quests/:questId/reports", () => {
  beforeEach(() => {
    process.env.APP_ENV = "local";
    process.env.APP_ORIGIN = "http://127.0.0.1:3000";
    sessionMocks.verifyVisitorSession.mockReset();
    reportMocks.submitReport.mockReset();
    sessionMocks.verifyVisitorSession.mockResolvedValue({
      outcome: "valid",
      visitorId: "visitor-1",
      expiresAt: "2026-12-21T00:00:00.000Z",
      rehashed: false,
    });
  });

  afterEach(() => {
    delete process.env.APP_ENV;
    delete process.env.APP_ORIGIN;
  });

  it.each([
    ["created", 201],
    ["existing", 200],
  ])("maps %s reports to HTTP %i", async (outcome, status) => {
    const report = {
      id: "88888888-8888-4888-8888-888888888888",
      questId,
      versionId,
      category: "information",
      status: "new",
      createdAt: "2026-11-21T09:35:00.000Z",
    };
    reportMocks.submitReport.mockResolvedValue({ outcome, report });

    const response = await POST(request(), context);

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual(report);
    expect(reportMocks.submitReport).toHaveBeenCalledWith({
      visitorId: "visitor-1",
      questId,
      ...validBody,
    });
  });

  it.each([
    [{ ...validBody, category: "unsafe" }],
    [{ ...validBody, versionId: "not-a-uuid" }],
    [{ ...validBody, comment: "あ".repeat(501) }],
    [{ ...validBody, unexpected: true }],
  ])("rejects invalid reports before session access", async (body) => {
    const response = await POST(request(body), context);

    expect(response.status).toBe(400);
    expect(sessionMocks.verifyVisitorSession).not.toHaveBeenCalled();
  });

  it("requires a visitor session", async () => {
    const response = await POST(request(validBody, false), context);

    expect(response.status).toBe(401);
    expect(reportMocks.submitReport).not.toHaveBeenCalled();
  });

  it.each([
    ["not_found", 404, "NOT_FOUND"],
    ["request_conflict", 409, "REQUEST_CONFLICT"],
  ])("maps %s to the public error contract", async (outcome, status, code) => {
    reportMocks.submitReport.mockResolvedValue({ outcome });

    const response = await POST(request(), context);

    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ error: { code } });
  });
});
