import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import type { UserRow } from "@/lib/permissions";
import { isBlockedByAdmin } from "@/lib/permissions";

export function Shell({ user, activePage, children }: { user: UserRow; activePage: string; children: ReactNode }) {
  const blocked = isBlockedByAdmin(user);

  return (
    <div className="app-shell">
      <Sidebar user={user} activePage={activePage} />
      <div>
        {blocked ? (
          <div className="banner banner-red">
            🔒 Votre compte est actuellement gelé par un administrateur ({user.adminFreezeReason}). Vous ne pouvez ni
            prendre, ni rédiger, ni envoyer d&apos;article tant que ce freeze n&apos;est pas levé.
          </div>
        ) : null}
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
