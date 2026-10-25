/**
 * CSV lisible par Excel en français : séparateur « ; », virgule décimale, BOM UTF-8. Une valeur nulle
 * (masquée sous 5 personnes) donne une cellule vide.
 */
export type Cell = string | number | null | undefined;

function cell(v: Cell): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v).replace(".", ",") : "";
  // Ni injection de formule (=, +, -, @) ni séparateur mal échappé.
  const s = /^[=+\-@]/.test(v) ? `'${v}` : v;
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: Cell[][]): string {
  return `﻿${[header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n")}\r\n`;
}
