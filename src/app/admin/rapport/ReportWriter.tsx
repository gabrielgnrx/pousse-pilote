"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Narrative } from "./Narrative";
import { FormError } from "@/components/ui";

/** Lance la rédaction de la synthèse et l'affiche au fil de l'eau, puis recharge la version enregistrée. */
export function ReportWriter({ org, month, hasSaved }: { org: string; month: string; hasSaved: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    setText("");
    try {
      const res = await fetch("/admin/rapport/generer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ org, month }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setText((t) => t + decoder.decode(value, { stream: true }));
      }
      router.refresh();
      setText("");
    } catch {
      setError("La synthèse n'a pas pu être rédigée. Réessaie dans un instant.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {text ? (
        <div aria-live="polite" className="rounded-2xl bg-creme p-4">
          <Narrative text={text} />
        </div>
      ) : null}
      <FormError message={error} />
      <button type="button" onClick={generate} disabled={busy} className="btn-dark min-h-11 self-start text-sm disabled:opacity-60">
        {busy ? "Rédaction en cours…" : hasSaved ? "Rédiger à nouveau la synthèse" : "Rédiger la synthèse"}
      </button>
    </div>
  );
}
