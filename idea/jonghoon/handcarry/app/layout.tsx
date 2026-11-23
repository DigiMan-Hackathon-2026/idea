import type { Metadata } from "next";
import { Noto_Sans_JP, Noto_Sans_KR, Nunito, Poppins, Space_Mono } from "next/font/google";
import { SERVICE_NAME } from "@/lib/config";
import "./globals.css";

const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["600", "700", "800"] });
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"] });
const spaceMono = Space_Mono({ variable: "--font-space-mono", subsets: ["latin"], weight: "400" });
// CJK fonts are large; they load on demand instead of being preloaded.
const notoKr = Noto_Sans_KR({ variable: "--font-noto-kr", preload: false });
const notoJp = Noto_Sans_JP({ variable: "--font-noto-jp", preload: false });

export const metadata: Metadata = {
  title: SERVICE_NAME.ko,
  description: "일본인 여행자 핸드캐리 중개 서비스 시연용 프로토타입",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const fonts = [poppins, nunito, spaceMono, notoKr, notoJp].map((f) => f.variable).join(" ");
  return (
    <html lang="ko" className={`${fonts} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
