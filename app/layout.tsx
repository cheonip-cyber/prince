import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "프린스팜 STUDIO — 상세페이지 스튜디오",
  description: "과일·채소 판매자를 위한 AI 상세페이지 자동화 스튜디오",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
