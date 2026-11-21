import { getLineTwoStation, getLineTwoTrip } from "./line-two";

// The static offline screen reads the same versioned browser entry.
const storageKey = "yeogiseoul.subway-ride.v1";
const changed = "yeogiseoul:subway-ride-changed";

export type SubwayRide = {
  origin: string;
  destination: string;
  situation: "before" | "onboard" | "exit";
  transfer: string;
};

export const emptySubwayRide: SubwayRide = {
  origin: "",
  destination: "",
  situation: "before",
  transfer: "",
};

export function subscribeToSavedRide(listener: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key === storageKey || event.key === null) listener();
  }
  window.addEventListener("storage", onStorage);
  window.addEventListener(changed, listener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(changed, listener);
  };
}

export function readSavedRide() {
  try {
    return window.localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

export function restoreSubwayRide(raw: string | null): SubwayRide | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    const origin = value?.origin?.code;
    const destination = value?.destination?.code;
    const situation = value?.situation;
    if (!getLineTwoStation(origin) || !getLineTwoStation(destination)) return null;
    if (situation !== "before" && situation !== "onboard" && situation !== "exit") return null;
    return { origin, destination, situation, transfer: value.transfer === origin ? origin : "" };
  } catch {
    return null;
  }
}

export function saveSubwayRide(ride: SubwayRide) {
  try {
    const origin = getLineTwoStation(ride.origin);
    const destination = getLineTwoStation(ride.destination);
    if (origin && destination) {
      const trip = getLineTwoTrip(origin.code, destination.code);
      window.localStorage.setItem(storageKey, JSON.stringify({
        origin,
        destination,
        situation: ride.situation,
        transfer: ride.transfer,
        next: trip?.stops[1] ?? null,
      }));
    } else {
      window.localStorage.removeItem(storageKey);
    }
    window.dispatchEvent(new Event(changed));
    return true;
  } catch {
    return false;
  }
}
