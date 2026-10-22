import { GRADE_LABEL, type Grade } from "@/lib/off/product.ts";

const STYLE: Record<Grade, string> = {
  "a-plus": "bg-[#1e6b3a] text-white",
  a: "bg-[#2f8a4a] text-white",
  b: "bg-[#8bbf4a] text-[#1d2a10]",
  c: "bg-[#f2c94c] text-[#3d2f05]",
  d: "bg-[#f0a058] text-[#3d2008]",
  e: "bg-[#e0663a] text-white",
  f: "bg-[#c0392b] text-white",
};

/** Pastille Green-Score (A+ à F), grise si le produit n'est pas encore noté. */
export function GradeBadge({ grade, size = "md" }: { grade: Grade | null; size?: "sm" | "md" | "lg" }) {
  const dims = size === "lg" ? "size-16 text-2xl rounded-2xl" : size === "sm" ? "size-8 text-sm rounded-lg" : "size-11 text-lg rounded-xl";
  return (
    <span
      className={`flex shrink-0 items-center justify-center font-display ${dims} ${grade ? STYLE[grade] : "bg-trait text-terre"}`}
      aria-label={grade ? `Green-Score ${GRADE_LABEL[grade]}` : "Green-Score non disponible"}
    >
      {grade ? GRADE_LABEL[grade] : "?"}
    </span>
  );
}
