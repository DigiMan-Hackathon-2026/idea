export type SeoulMetroDataStatus =
  | "ready"
  | "partial"
  | "not_configured"
  | "unavailable";

export type SeoulMetroElevator = {
  operatingStatus: string | null;
  facilityName: string | null;
  entranceNumber: string | null;
  detailPosition: string | null;
  startFloor: string | null;
  endFloor: string | null;
  referenceDate: string | null;
};

export type SeoulMetroQuickExit = {
  direction: string | null;
  nextStation: string | null;
  carDoorNumber: string | null;
  facility: string | null;
  facilityPosition: string | null;
  referenceDate: string | null;
};

export type SeoulMetroStationSnapshot = {
  status: SeoulMetroDataStatus;
  checkedAt: string | null;
  elevatorAvailable: boolean;
  quickExitAvailable: boolean;
  elevators: SeoulMetroElevator[];
  quickExits: SeoulMetroQuickExit[];
};
