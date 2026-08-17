import Image from "next/image";
import Link from "next/link";
import type { UserRow } from "@/lib/permissions";
import { isAdmin, roleLabels } from "@/lib/permissions";

export function Sidebar({ user, activePage }: { user: UserRow; activePage: string }) {
  const admin = isAdmin(user.role as "journaliste" | "admin" | "redac_chef");
  const roleClass = user.role === "redac_chef" ? "redac-chef" : user.role;
  const displayName = user.rpFirstName || user.rpLastName ? `${user.rpFirstName} ${user.rpLastName}`.trim() : user.robloxUsername;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Image src="/logo.png" alt="Logo" width={42} height={42} />
        <div>
          <div className="brand-title">
            Bureau Auxiliaire
            <br />
            de Presse
          </div>
          <div className="brand-sub">Sécurité Info. &amp; Arch.</div>
        </div>
      </div>

      <div className="nav-group">
        <div className="nav-group-title">Espace journaliste</div>
        <Link href="/profil" className={`nav-link ${activePage === "profil" ? "active" : ""}`}>
          <span className="dot" />
          Mon profil
        </Link>
        <Link href="/articles" className={`nav-link ${activePage === "articles" ? "active" : ""}`}>
          <span className="dot" />
          Articles disponibles
        </Link>

        {admin ? (
          <>
            <div className="nav-group-title">Administration</div>
            <Link href="/admin" className={`nav-link ${activePage === "admin" ? "active" : ""}`}>
              <span className="dot" />
              Panel administrateur
            </Link>
          </>
        ) : null}
      </div>

      <div className="sidebar-footer">
        <div className="ui-label" style={{ marginBottom: 6 }}>
          Connecté en tant que
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          {user.robloxAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.robloxAvatarUrl}
              alt=""
              style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid var(--border)" }}
            />
          ) : (
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--panel-3)" }} />
          )}
          <div>
            <div style={{ fontSize: 13, color: "var(--text)" }}>{displayName}</div>
            <div style={{ fontSize: 11, color: "var(--text-faint)" }}>@{user.robloxUsername}</div>
          </div>
        </div>
        <span className={`role-badge ${roleClass}`}>{roleLabels[user.role as "journaliste" | "admin" | "redac_chef"]}</span>
        <div className="divider" />
        <a href="/api/auth/logout" className="nav-link" style={{ fontSize: 12, color: "var(--text-faint)" }}>
          ↩ Se déconnecter
        </a>
      </div>
    </aside>
  );
}
