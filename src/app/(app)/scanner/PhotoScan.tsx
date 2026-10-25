"use client";
import { useFormStatus } from "react-dom";
import { compressInput } from "@/lib/image/compress";
import { scanPhoto } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-dark min-h-11 text-sm">
      {pending ? "Reconnaissance…" : "Reconnaître le produit"}
    </button>
  );
}

/** Pas de code-barres ? Une photo du produit : l'IA reconnaît la catégorie (la photo n'est pas gardée). */
export function PhotoScan() {
  return (
    <form action={scanPhoto} className="card flex flex-col gap-2">
      <p className="label">Pas de code-barres ?</p>
      <label className="text-sm font-semibold" htmlFor="photo-produit">
        Prends le produit en photo : on te donne l&apos;impact typique de sa catégorie.
      </label>
      <input
        id="photo-produit"
        name="photo"
        type="file"
        required
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="text-sm"
        onChange={(e) => void compressInput(e.currentTarget)}
      />
      <Submit />
    </form>
  );
}
