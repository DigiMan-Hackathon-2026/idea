import Link from "next/link";

export default function OfflinePage() {
  return (
    <main
      style={{
        alignItems: "center",
        background: "#f8f5ef",
        color: "#504e49",
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
          borderRadius: "16px",
          boxShadow: "0 6px 22px rgba(80, 78, 73, 0.09)",
          margin: "0 auto",
          maxWidth: "560px",
          padding: "32px",
          width: "100%",
        }}
      >
        <h1 style={{ fontSize: "28px", lineHeight: 1.25, margin: 0 }}>
          オフラインです
        </h1>
        <p style={{ color: "#594743", lineHeight: 1.7, margin: "12px 0 0" }}>
          接続を確認して、もう一度お試しください。進行記録はこのブラウザに残っています。
        </p>
        <hr style={{ border: 0, borderTop: "1px solid #a4a199", margin: "28px 0" }} />
        <h2 style={{ fontSize: "22px", lineHeight: 1.3, margin: 0 }}>
          인터넷에 연결되지 않았어요
        </h2>
        <p style={{ color: "#594743", lineHeight: 1.7, margin: "12px 0 0" }}>
          연결 상태를 확인하고 다시 시도해 주세요. 진행 기록은 이 브라우저에 남아 있어요.
        </p>
        <Link
          href="/"
          style={{
            background: "#455f54",
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
        <a href="/subway" style={{ display: "inline-flex", alignItems: "center", minHeight: "44px", marginTop: "12px", color: "#941e34" }}>
          地下鉄の保存情報を開く · 저장한 지하철 안내 열기
        </a>
      </section>
    </main>
  );
}
