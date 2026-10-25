import { JoinFlow } from "./JoinFlow";

/** Le lien d'invitation de l'entreprise (/rejoindre?code=ACME-1A2B) préremplit le code. */
export default async function RejoindrePage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  const clean = typeof code === "string" && /^[A-Za-z0-9-]{3,20}$/.test(code) ? code.toUpperCase() : undefined;
  return <JoinFlow initialMode="join" initialCode={clean} />;
}
