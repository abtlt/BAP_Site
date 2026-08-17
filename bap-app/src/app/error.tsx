"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="login-wrap">
      <div className="login-card" style={{ textAlign: "left" }}>
        <h1 style={{ color: "var(--red)", textAlign: "center" }}>Une erreur est survenue</h1>
        <p className="sub" style={{ textAlign: "center" }}>{error.message || "Erreur inattendue."}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16 }}>
          <button className="btn btn-primary" onClick={() => reset()}>
            Réessayer
          </button>
          <a className="btn" href="/">
            Retour à l&apos;accueil
          </a>
        </div>
      </div>
    </div>
  );
}
