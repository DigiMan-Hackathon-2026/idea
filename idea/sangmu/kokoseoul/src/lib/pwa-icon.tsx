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
            color: "#c93418",
            display: "flex",
            fontFamily: "Arial, sans-serif",
            fontSize: Math.round(size * 0.42),
            fontWeight: 900,
            height: "72%",
            justifyContent: "center",
            lineHeight: 1,
            width: "72%",
          }}
        >
          D
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
