import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gratitude",
  description: "A private daily gratitude book for two people.",
  manifest: "/manifest.json",
  applicationName: "Gratitude",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Gratitude"
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon.svg", type: "image/svg+xml", sizes: "any" }
    ],
    apple: [{ url: "/apple-touch-icon.png" }]
  },
  formatDetection: {
    telephone: false
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#fbfaf7"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
