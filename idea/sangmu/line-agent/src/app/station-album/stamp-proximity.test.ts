import { describe, expect, it } from "vitest";
import { checkStampProximity } from "./stamp-proximity";

describe("station stamp proximity", () => {
  const point = [37.5, 127] as const;
  const nearby = { latitude: 37.5, longitude: 127, accuracy: 15 };

  it("accepts an accurate fix near either platform of a transfer station", () => {
    expect(checkStampProximity(nearby, [[37.6, 127], point])).toBe("nearby");
  });

  it("does not accept a center outside the 200 m radius", () => {
    expect(checkStampProximity({ ...nearby, latitude: 37.502 }, [point])).toBe("too-far");
  });

  it("does not accept an uncertain fix that could be outside the radius", () => {
    expect(checkStampProximity({ ...nearby, latitude: 37.5016, accuracy: 30 }, [point])).toBe("inaccurate");
    expect(checkStampProximity({ ...nearby, accuracy: 101 }, [point])).toBe("inaccurate");
    expect(checkStampProximity({ ...nearby, accuracy: NaN }, [point])).toBe("inaccurate");
  });
});
