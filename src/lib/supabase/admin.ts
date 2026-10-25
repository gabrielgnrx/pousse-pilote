import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Client avec la clé de service : uniquement pour les tâches du serveur qui ne peuvent pas passer par la
 * session d'une personne (lire un justificatif du bucket privé pour le vérifier, purger les photos).
 * Sans clé configurée, ces tâches sont simplement sautées.
 */
export function adminDb() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false } });
}
