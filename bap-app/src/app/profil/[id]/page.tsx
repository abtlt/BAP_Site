import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/session";
import { ProfileView } from "@/components/ProfileView";

// Ouvert à tout journaliste connecté (pas seulement aux administrateurs) :
// on peut consulter la fiche de n'importe quel membre du Bureau, par
// exemple depuis l'organigramme. Les sections d'administration restent
// masquées automatiquement dans ProfileView pour un viewer non-admin.
export default async function JournalistProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login");

  const { id } = await params;
  const db = getDb();
  const [target] = await db.select().from(schema.users).where(eq(schema.users.robloxId, id)).limit(1);
  if (!target) notFound();

  return <ProfileView viewer={viewer} target={target} />;
}
