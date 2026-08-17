import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_state: "La demande de connexion a expiré ou est invalide. Merci de réessayer.",
  oauth_failed: "La connexion avec Roblox a échoué. Merci de réessayer.",
  access_denied: "Vous avez refusé l'accès à votre compte Roblox.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect("/profil");

  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] || "La connexion a échoué. Merci de réessayer." : null;

  return (
    <div className="login-wrap">
      <div className="login-card">
        <Image className="logo" src="/logo.png" alt="Logo Bureau Auxiliaire de Presse" width={96} height={96} />
        <h1>Bureau Auxiliaire de Presse</h1>
        <div className="sub">Administration de la Sécurité de l&apos;Information &amp; des Archives</div>

        {errorMessage ? (
          <div className="tag tag-red" style={{ display: "block", marginBottom: 18, padding: "8px 12px" }}>
            {errorMessage}
          </div>
        ) : null}

        <a href="/api/auth/login" className="roblox-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <rect x="2.2" y="6.7" width="14.6" height="14.6" rx="1.2" transform="rotate(-15 2.2 6.7)" fill="#1c1c1c" />
          </svg>
          Se connecter avec Roblox
        </a>

        <div className="scope-note">
          <b>Permissions demandées :</b> nom d&apos;utilisateur Roblox uniquement, via l&apos;API de connexion officielle
          Roblox (OAuth 2.0). Aucune autre donnée de votre compte n&apos;est demandée. L&apos;accès au site est réservé
          aux personnes pré-autorisées par la rédaction.
        </div>
      </div>
    </div>
  );
}
