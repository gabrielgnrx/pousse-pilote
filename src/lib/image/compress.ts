/**
 * Compression des photos dans le navigateur avant l'envoi (sobriété : moins de données transférées et
 * stockées). La photo est redimensionnée à 1 600 px au plus et réencodée en WebP (ou JPEG si le
 * navigateur ne sait pas). En cas d'échec, le fichier d'origine est envoyé tel quel.
 */
export async function compressImage(file: File, maxSide = 1600, quality = 0.82): Promise<File> {
  if (typeof window === "undefined" || !file.type.startsWith("image/") || typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    const out = blob && blob.type === "image/webp" ? blob : await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!out || out.size >= file.size) return file;
    const ext = out.type === "image/webp" ? "webp" : "jpg";
    return new File([out], file.name.replace(/\.[^.]+$/, "") + "." + ext, { type: out.type });
  } catch {
    return file;
  }
}

/**
 * À brancher sur l'événement onChange d'un champ fichier : remplace la photo choisie par sa version
 * compressée, avant tout envoi du formulaire (qui reste un formulaire ordinaire).
 */
export async function compressInput(input: HTMLInputElement): Promise<void> {
  const f = input.files?.[0];
  if (!f || typeof DataTransfer === "undefined") return;
  const small = await compressImage(f);
  if (small === f) return;
  const dt = new DataTransfer();
  dt.items.add(small);
  input.files = dt.files;
}
