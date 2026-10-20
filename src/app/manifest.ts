import type { MetadataRoute } from "next";

/** Pousse s'installe comme une appli (écran d'accueil, plein écran, icône). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pousse — moins de CO₂, plus de fun",
    short_name: "Pousse",
    description: "Relève des défis bas carbone avec tes collègues et fais pousser ta plante.",
    lang: "fr",
    start_url: "/fil?source=appli",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4e8d0",
    theme_color: "#f4e8d0",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Scanner un produit", url: "/scanner", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Enregistrer une action", url: "/agir", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
