"use client";

import { useRouter } from "next/navigation";
import { NearbyStationPicker } from "@/app/subway/nearby-station-picker";

export function StationLocator({ path }: { path: string }) {
  const router = useRouter();
  return <NearbyStationPicker onSelect={(code) => router.push(`${path}?station=${encodeURIComponent(code)}#station-quests`)} />;
}
