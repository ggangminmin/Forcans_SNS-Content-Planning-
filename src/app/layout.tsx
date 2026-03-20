import type { Metadata } from "next";
import { Inter } from "next/font/google"
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Content Ideation Agent",
  description: "SNS 콘텐츠 기획 에이전트",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
