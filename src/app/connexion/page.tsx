import { JoinFlow } from "../rejoindre/JoinFlow";

export const metadata = { title: "Connexion · Pousse" };

export default function ConnexionPage() {
  return <JoinFlow initialMode="login" />;
}
