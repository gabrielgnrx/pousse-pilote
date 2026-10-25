/**
 * Minimisation des données envoyées à l'IA : aucune donnée personnelle superflue dans les prompts.
 * On retire ce qui identifie quelqu'un (e-mail, téléphone, adresse web, longues suites de chiffres
 * comme un numéro de billet ou de carte) et on borne la longueur. Les nombres utiles (8 km, 2 repas)
 * restent intacts.
 */

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu;
const URL = /\bhttps?:\/\/\S+|\bwww\.\S+/gi;
// Téléphones français et internationaux : +33 6 12 34 56 78, 06.12.34.56.78, 0612345678.
const PHONE = /(?:\+\d{1,3}[\s.-]?)?(?:\(?0\)?[\s.-]?)?[1-9](?:[\s.-]?\d{2}){4}\b/g;
// Suites de 8 chiffres ou plus (numéros de billet, de commande, de carte) : jamais utiles au calcul.
const LONG_NUMBER = /\b\d[\d\s-]{7,}\d\b/g;

export function redact(text: string, maxLength = 300): string {
  return text
    .replace(EMAIL, "[e-mail]")
    .replace(URL, "[lien]")
    .replace(PHONE, "[téléphone]")
    .replace(LONG_NUMBER, "[numéro]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

/** Forme canonique d'une saisie, pour la clé de cache : casse, espaces et ponctuation finale neutralisés. */
export function normalizeForCache(text: string): string {
  return redact(text)
    .toLocaleLowerCase("fr-FR")
    .normalize("NFC")
    .replace(/[\s.!?…]+$/u, "")
    .replace(/\s+/g, " ");
}
