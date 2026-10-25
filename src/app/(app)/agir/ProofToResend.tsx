import { actionTitle } from "@/lib/actions-catalog";
import { formatDay } from "@/lib/dates";
import { SubmitButton } from "@/components/ui";
import { resubmitProof } from "./actions";

export interface ProofRow {
  id: string;
  template_id: string;
  variant: string;
  day: string;
}

const STATUS: Record<string, string> = {
  envoye: "Photo envoyée : on la vérifie, tu seras prévenu.",
  erreur: "La photo n'a pas pu être envoyée. Réessaie.",
  format: "Photo au format JPEG, PNG ou WebP, 5 Mo au plus (une capture d'écran convient).",
  essais: "Tu as déjà envoyé deux photos pour cette action : elle reste comptée, sans ses pousses.",
};

/** Les justificatifs à renvoyer : une photo plus nette, et les pousses mises de côté reviennent. */
export function ProofToResend({ rows, status }: { rows: ProofRow[]; status: string | null }) {
  if (!rows.length && !status) return null;
  return (
    <section aria-labelledby="justificatifs" className="flex flex-col gap-2 rounded-[24px] bg-peche p-4 text-[#3a1606] shadow-[inset_0_-4px_0_var(--color-peche-fonce)]">
      <h2 id="justificatifs" className="font-display text-lg">Justificatif à renvoyer</h2>
      {status && STATUS[status] ? <p role="status" className="text-sm font-semibold">{STATUS[status]}</p> : null}
      {rows.map((r) => (
        <form key={r.id} action={resubmitProof} className="flex flex-col gap-2 rounded-2xl bg-papier p-3 text-encre">
          <input type="hidden" name="validation" value={r.id} />
          <p className="text-sm font-semibold">
            {actionTitle(r.template_id, r.variant)} · {formatDay(r.day, "short")}
          </p>
          <p className="text-xs text-terre">On n&apos;a pas pu lire la photo. Envoie-la de nouveau, bien nette : tes pousses t&apos;attendent.</p>
          <label className="text-sm">
            <span className="sr-only">Nouvelle photo du justificatif</span>
            <input name="receipt" type="file" required accept="image/jpeg,image/png,image/webp" capture="environment" className="text-sm" />
          </label>
          <SubmitButton className="btn-dark min-h-11 text-sm" pendingLabel="Envoi…">Envoyer la photo</SubmitButton>
        </form>
      ))}
      <p className="text-xs">Ta photo reste privée : elle est vérifiée automatiquement par l&apos;IA de Pousse, puis effacée.</p>
    </section>
  );
}
