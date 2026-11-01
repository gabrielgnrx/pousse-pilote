import { IslandControls } from "@/components/island/IslandControls";

export const metadata = { title: "Ton île · Pousse" };

/** L'île en plein écran : le monde est monté par le layout, la page pose les commandes du jeu. */
export default function IlePage() {
  return <IslandControls />;
}
