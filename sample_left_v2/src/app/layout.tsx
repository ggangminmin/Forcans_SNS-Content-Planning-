import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "포켄스 SNS 콘텐츠 기획",
  description: "AI 기반 멀티 에이전트 콘텐츠 기획 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased font-body">
        <main className="min-h-screen bg-[#f1f5f9]">
          {children}
        </main>
      </body>
    </html>
  );
}
