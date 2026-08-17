import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/session";
import { isAdmin } from "@/lib/permissions";
import { ProfileView } from "@/components/ProfileView";

export default async function JournalistProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login");
  if (!isAdmin(viewer.role as "journaliste" | "admin" | "redac_chef")) redirect("/profil");

  const { id } = await params;
  const db = getDb();
  const [target] = await db.select().from(schema.users).where(eq(schema.users.robloxId, id)).limit(1);
  if (!target) notFound();

  return <ProfileView viewer={viewer} target={target} />;
}
