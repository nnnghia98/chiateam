import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Football Lineup | Đội hình thi đấu",
  description: "Xem đội hình thi đấu bóng đá được cập nhật qua Telegram Bot",
  keywords: ["football", "lineup", "soccer", "team", "telegram"],
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚽</text></svg>",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
