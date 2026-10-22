import { requireProfile } from "@/lib/session";
import { FeedbackForm } from "./FeedbackForm";

export default async function AvisPage() {
  const { profile } = await requireProfile();
  return (
    <>
      <div>
        <h1 className="font-display text-2xl">Ta semaine avec Pousse</h1>
        <p className="mt-1 text-sm text-terre">
          3 questions, 30 secondes. Lues par l&apos;équipe Pousse uniquement, jamais par ton employeur.
        </p>
      </div>
      {profile.consent_feedback ? (
        <FeedbackForm />
      ) : (
        <p className="card text-sm">Tu as choisi de ne pas recevoir de questionnaire. Tu peux changer ce choix dans ton profil.</p>
      )}
    </>
  );
}
