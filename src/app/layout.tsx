import type { Metadata, Viewport } from "next";
import { Calistoga, Inter } from "next/font/google";
import "./globals.css";
import { SwRegister } from "@/components/SwRegister";

const calistoga = Calistoga({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-calistoga",
});
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Pousse — moins de CO₂, plus de fun",
  description:
    "Calcule ton empreinte carbone, relève des défis avec tes collègues et regarde-la fondre.",
  applicationName: "Pousse",
  appleWebApp: { capable: true, title: "Pousse", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/favicon-32.png", sizes: "32x32", type: "image/png" }, { url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#f6f3ea",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${calistoga.variable} ${inter.variable}`}>
      <body className="min-h-dvh">
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
