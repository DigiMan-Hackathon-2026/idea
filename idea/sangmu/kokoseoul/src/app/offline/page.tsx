import Link from "next/link";

export default function OfflinePage() {
  return (
    <main
      style={{
        alignItems: "center",
        background: "#f7f3eb",
        color: "#0f172a",
        display: "flex",
        fontFamily: "system-ui, sans-serif",
        minHeight: "100vh",
        padding: "24px",
      }}
    >
      <section
        style={{
          background: "white",
          border: "1px solid rgba(15, 23, 42, 0.08)",
          borderRadius: "28px",
          boxShadow: "0 24px 80px rgba(41, 37, 31, 0.09)",
          margin: "0 auto",
          maxWidth: "560px",
          padding: "32px",
          width: "100%",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            alignItems: "center",
            background: "#ff5a36",
            borderRadius: "16px",
            color: "white",
            display: "flex",
            fontSize: "24px",
            fontWeight: 900,
            height: "48px",
            justifyContent: "center",
            width: "48px",
          }}
        >
          ✦
        </div>
        <h1 style={{ fontSize: "28px", lineHeight: 1.25, margin: "24px 0 0" }}>
          オフラインです
        </h1>
        <p style={{ color: "#475569", lineHeight: 1.7, margin: "12px 0 0" }}>
          接続を確認して、もう一度お試しください。進行記録はこのブラウザに残っています。
        </p>
        <hr style={{ border: 0, borderTop: "1px solid #e2e8f0", margin: "28px 0" }} />
        <h2 style={{ fontSize: "22px", lineHeight: 1.3, margin: 0 }}>
          인터넷에 연결되지 않았어요
        </h2>
        <p style={{ color: "#475569", lineHeight: 1.7, margin: "12px 0 0" }}>
          연결 상태를 확인하고 다시 시도해 주세요. 진행 기록은 이 브라우저에 남아 있어요.
        </p>
        <Link
          href="/"
          style={{
            background: "#0f172a",
            borderRadius: "16px",
            color: "white",
            cursor: "pointer",
            display: "block",
            fontSize: "16px",
            fontWeight: 800,
            marginTop: "28px",
            minHeight: "52px",
            padding: "12px 20px",
            textAlign: "center",
            textDecoration: "none",
            width: "100%",
          }}
        >
          再読み込み · 다시 불러오기
        </Link>
      </section>
    </main>
  );
}
