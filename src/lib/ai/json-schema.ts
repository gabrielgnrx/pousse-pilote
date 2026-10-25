/**
 * Prépare un JSON Schema (produit par z.toJSONSchema) pour les sorties structurées de l'API Claude.
 *
 * L'API refuse certains mots-clés (bornes numériques, longueurs, nombre d'éléments au-delà de 0 ou 1,
 * additionalProperties autre que false). On les retire ici : ces contraintes restent appliquées par
 * zod à la réception, ce qui est de toute façon la seule validation qui fait foi.
 * Doc : https://platform.claude.com/docs/en/build-with-claude/structured-outputs
 */

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

const DROPPED = new Set([
  "$schema",
  "$id",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "pattern",
  "format",
  "maxItems",
  "default",
  "examples",
]);

/** Maps dont les clés sont des noms choisis par nous (propriétés, définitions), pas des mots-clés. */
const NAME_MAPS = new Set(["properties", "$defs", "definitions", "patternProperties"]);

function clean(node: Json): Json {
  if (Array.isArray(node)) return node.map(clean);
  if (node === null || typeof node !== "object") return node;
  const out: { [k: string]: Json } = {};
  for (const [k, v] of Object.entries(node)) {
    if (DROPPED.has(k) || k === "additionalProperties") continue;
    if (k === "minItems") {
      if (v === 0 || v === 1) out[k] = v;
      continue;
    }
    if (NAME_MAPS.has(k) && v !== null && typeof v === "object" && !Array.isArray(v)) {
      out[k] = Object.fromEntries(Object.entries(v).map(([name, sub]) => [name, clean(sub)]));
      continue;
    }
    out[k] = clean(v);
  }
  if (out.type === "object" || "properties" in out) {
    out.additionalProperties = false;
  }
  return out;
}

export function toApiSchema(schema: Record<string, unknown>): Record<string, unknown> {
  return clean(schema as Json) as Record<string, unknown>;
}
