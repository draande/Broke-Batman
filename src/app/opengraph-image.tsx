import { ImageResponse } from "next/og";
import { brand } from "@/lib/brand";
export const alt = "Broke Batman — Gotham isn't paying the bills.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function SocialImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 90,
        background: "#111318",
        color: "#f1f2f4",
        borderBottom: "12px solid #d6b55b",
      }}
    >
      <svg width="104" height="104" viewBox="0 0 48 48">
        <path d={brand.markPath} fill="#d6b55b" />
      </svg>
      <div
        style={{
          display: "flex",
          fontSize: 76,
          fontWeight: 700,
          marginTop: 26,
        }}
      >
        Broke Batman
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 36,
          color: "#d6b55b",
          marginTop: 18,
        }}
      >
        Gotham isn&apos;t paying the bills.
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 24,
          color: "#a4abb7",
          marginTop: 30,
        }}
      >
        Applications · Interviews · Email intelligence
      </div>
    </div>,
    size,
  );
}
