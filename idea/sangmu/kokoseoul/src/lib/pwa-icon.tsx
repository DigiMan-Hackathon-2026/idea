import { ImageResponse } from "next/og";

export function createPwaIcon(size: number) {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#ff5a36",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            alignItems: "center",
            background: "#fffaf2",
            borderRadius: "24%",
            display: "flex",
            height: "72%",
            justifyContent: "center",
          position: "relative",
            width: "72%",
          }}
        >
        <div
          style={{
            background: "#c93418",
            borderRadius: 999,
            height: "18%",
            position: "absolute",
            width: "58%",
          }}
        />
        <div
          style={{
            background: "#c93418",
            borderRadius: 999,
            height: "58%",
            position: "absolute",
            width: "18%",
          }}
        />
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
