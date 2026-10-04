import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Broke Batman · Job search command center",
  description:
    "Gotham isn't paying the bills. A job application command center.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
