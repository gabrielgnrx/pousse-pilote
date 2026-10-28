import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import "./globals.css";
import { SwRegister } from "@/components/SwRegister";

// Titres et chiffres : Bricolage Grotesque (700, 800). Texte : Figtree.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-bricolage",
});
const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
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
  themeColor: "#f3f6f0",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${bricolage.variable} ${figtree.variable}`}>
      <body className="min-h-dvh">
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
