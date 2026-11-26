import { describe, expect, it } from "vitest";
import type { SeoulMetroQuickExit } from "./seoul-metro";
import {
  decodeElevatorStatus,
  isSurfaceElevator,
  selectQuickExit,
} from "./seoul-metro-display";

const quickExits: SeoulMetroQuickExit[] = [
  { direction: "상행", nextStation: "뚝섬", carDoorNumber: "7-1", facility: "엘리베이터", facilityPosition: "뚝섬 방면7-1", referenceDate: "20241231" },
  { direction: "하행", nextStation: "건대입구", carDoorNumber: "4-4", facility: "엘리베이터", facilityPosition: "건대입구 방면4-4", referenceDate: "20241231" },
  { direction: "상행", nextStation: "뚝섬", carDoorNumber: "1-1", facility: "계단", facilityPosition: null, referenceDate: "20241231" },
];

describe("Seoul Metro display rules", () => {
  it("decodes every documented elevator status code", () => {
    expect(["M", "D", "S", "T", "I", "B"].map(decodeElevatorStatus)).toEqual([
      "available",
      "deleted",
      "maintenance",
      "stopped",
      "inspection",
      "construction",
    ]);
    expect(decodeElevatorStatus("unexpected")).toBe("unknown");
  });

  it("maps the previous station to the train's next-station direction", () => {
    expect(selectQuickExit(quickExits, "from_ttukseom", "elevator_needed")?.carDoorNumber).toBe("4-4");
    expect(selectQuickExit(quickExits, "from_konkuk", "stairs_ok")?.carDoorNumber).toBe("1-1");
    expect(selectQuickExit(quickExits, "from_yongdap", "elevator_needed")).toBeNull();
    expect(selectQuickExit(quickExits, "unknown", "stairs_ok")).toBeNull();
  });

  it("distinguishes exit elevators from internal platform elevators", () => {
    expect(isSurfaceElevator({ operatingStatus: "M", facilityName: null, entranceNumber: "4", detailPosition: null, startFloor: "1", endFloor: "2", referenceDate: null })).toBe(true);
    expect(isSurfaceElevator({ operatingStatus: "M", facilityName: null, entranceNumber: "내부", detailPosition: null, startFloor: "2", endFloor: "3", referenceDate: null })).toBe(false);
  });
});
