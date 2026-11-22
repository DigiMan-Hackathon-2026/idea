import { Suspense } from "react";
import { SubwaySignCamera } from "@/components/subway-sign-camera";
import { getSubwaySignDirections, getSubwayStation } from "@/modules/transit/subway-network";

type CameraParams = Promise<{ platform?: string | string[]; destination?: string | string[] }>;

async function SignCameraContent({ searchParams }: { searchParams: CameraParams }) {
  const params = await searchParams;
  const platform = typeof params.platform === "string" ? getSubwayStation(params.platform) : undefined;
  const destination = typeof params.destination === "string" ? getSubwayStation(params.destination) : undefined;
  const directions = platform && destination ? getSubwaySignDirections(platform.code, destination.code) : null;
  return <SubwaySignCamera
    line={platform?.line ?? 3}
    platform={platform ?? null}
    next={directions?.next ?? null}
    directions={directions && { forward: directions.forward, away: directions.away }}
  />;
}

export default function SubwaySignCameraPage({ searchParams }: { searchParams: CameraParams }) {
  return (
    <Suspense>
      <SignCameraContent searchParams={searchParams} />
    </Suspense>
  );
}
