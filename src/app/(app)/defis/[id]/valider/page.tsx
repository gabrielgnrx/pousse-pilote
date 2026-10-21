import { redirect } from "next/navigation";

/**
 * L'ancienne validation d'un défi (photo ou collègue témoin) n'existe plus : chaque fois qu'on fait
 * l'action, on l'enregistre avec le bouton +, et elle compte dans le défi. Les anciens liens y mènent.
 */
export default function ValiderPage() {
  redirect("/defis");
}
