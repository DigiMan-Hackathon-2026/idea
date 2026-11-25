import type { SeoulMetroElevator, SeoulMetroQuickExit } from "./seoul-metro";

export type ArrivalId =
  | "from_ttukseom"
  | "from_konkuk"
  | "from_yongdap"
  | "unknown";

export type MobilityId = "stairs_ok" | "elevator_needed";

export type ElevatorStatus =
  | "available"
  | "deleted"
  | "maintenance"
  | "stopped"
  | "inspection"
  | "construction"
  | "unknown";

const ARRIVAL_TO_NEXT_STATION: Partial<Record<ArrivalId, string>> = {
  from_ttukseom: "건대입구",
  from_konkuk: "뚝섬",
};

const ELEVATOR_STATUS: Record<string, ElevatorStatus> = {
  M: "available",
  D: "deleted",
  S: "maintenance",
  T: "stopped",
  I: "inspection",
  B: "construction",
};

export function decodeElevatorStatus(value: string | null): ElevatorStatus {
  if (!value) return "unknown";
  if (ELEVATOR_STATUS[value]) return ELEVATOR_STATUS[value];
  if (/정상|사용가능|운행/.test(value)) return "available";
  if (/보수/.test(value)) return "maintenance";
  if (/중지/.test(value)) return "stopped";
  if (/점검/.test(value)) return "inspection";
  if (/공사/.test(value)) return "construction";
  if (/삭제/.test(value)) return "deleted";
  return "unknown";
}

export function selectQuickExit(
  quickExits: SeoulMetroQuickExit[],
  arrival: ArrivalId | null,
  mobility: MobilityId | null,
): SeoulMetroQuickExit | null {
  if (!arrival) return null;
  const nextStation = ARRIVAL_TO_NEXT_STATION[arrival];
  if (!nextStation) return null;
  const candidates = quickExits.filter((item) => item.nextStation?.includes(nextStation));
  if (candidates.length === 0) return null;
  const preferredFacility = mobility === "elevator_needed" ? "엘리베이터" : "계단";
  return candidates.find((item) => item.facility?.includes(preferredFacility)) ?? candidates[0];
}

export function isSurfaceElevator(item: SeoulMetroElevator): boolean {
  return item.entranceNumber !== null && /^\d+$/.test(item.entranceNumber);
}
