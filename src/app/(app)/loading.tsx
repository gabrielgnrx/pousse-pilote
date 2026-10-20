/** Affiché pendant que la page se charge : la forme de la page, plutôt qu'un écran figé. */
export default function Loading() {
  return (
    <div role="status" aria-label="Chargement" className="flex flex-col gap-4 motion-safe:animate-pulse">
      <div className="h-8 w-2/3 rounded-xl bg-sable" />
      <div className="h-40 rounded-[20px] bg-sable" />
      <div className="h-24 rounded-[20px] bg-sable" />
      <div className="h-24 rounded-[20px] bg-sable" />
      <span className="sr-only">Chargement…</span>
    </div>
  );
}
