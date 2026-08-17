import Image from "next/image";

export default function AccessDeniedPage() {
  return (
    <div className="login-wrap">
      <div className="login-card">
        <Image className="logo" src="/logo.png" alt="Logo Bureau Auxiliaire de Presse" width={96} height={96} />
        <h1 style={{ color: "var(--red)" }}>Accès non autorisé</h1>
        <div className="sub">
          Votre compte Roblox n&apos;est pas dans la liste des personnes autorisées à accéder au site du Bureau
          Auxiliaire de Presse.
        </div>
        <div className="scope-note">
          Si vous pensez qu&apos;il s&apos;agit d&apos;une erreur, contactez un administrateur ou le rédacteur en chef
          pour qu&apos;il ajoute votre identifiant Roblox à la liste des accès autorisés.
        </div>
        <a href="/login" className="btn" style={{ marginTop: 18, justifyContent: "center" }}>
          Retour à la connexion
        </a>
      </div>
    </div>
  );
}
