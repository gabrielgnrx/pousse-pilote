import type { Metadata, Viewport } from "next";
import { Fraunces, Work_Sans } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-fraunces",
});
const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-work-sans",
});

export const metadata: Metadata = {
  title: "Pousse — moins de CO₂, plus de fun",
  description:
    "Calcule ton empreinte carbone, relève des défis avec tes collègues et regarde-la fondre.",
};

export const viewport: Viewport = {
  themeColor: "#f4e8d0",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${fraunces.variable} ${workSans.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
