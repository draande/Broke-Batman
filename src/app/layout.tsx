import { brand } from "@/lib/brand";
import type { Metadata } from "next";
import "@/app/globals.css";
export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: {
    default: "Broke Batman | Job Application Tracker",
    template: "%s | Broke Batman",
  },
  description: brand.description,
  applicationName: brand.name,
  icons: { icon: "/brand/mark.svg", apple: "/brand/mark.svg" },
  openGraph: {
    type: "website",
    siteName: brand.name,
    title: brand.name,
    description: brand.description,
  },
  twitter: {
    card: "summary_large_image",
    title: brand.name,
    description: brand.description,
    images: ["/opengraph-image"],
  },
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
