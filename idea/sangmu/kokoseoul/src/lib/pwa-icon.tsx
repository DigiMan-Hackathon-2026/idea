import { ImageResponse } from "next/og";

export function createPwaIcon(size: number) {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#941e34",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            alignItems: "center",
            background: "#dfdfdd",
            borderRadius: "20%",
            display: "flex",
            height: "72%",
            justifyContent: "center",
            position: "relative",
            width: "72%",
          }}
        >
          <div
            style={{
              background: "#e5b560",
              height: "13%",
              position: "absolute",
              top: "17%",
              width: "68%",
            }}
          />
          <div
            style={{
              background: "#504e49",
              height: "16%",
              position: "absolute",
              top: "37%",
              width: "68%",
            }}
          />
          <div
            style={{
              background: "#455f54",
              borderRadius: 999,
              bottom: "16%",
              height: "22%",
              position: "absolute",
              width: "22%",
            }}
          />
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
