import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { ProfileView } from "@/components/ProfileView";

export default async function OwnProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <ProfileView viewer={user} target={user} />;
}
