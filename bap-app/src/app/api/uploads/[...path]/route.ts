import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { NextRequest } from "next/server";

// Relit un fichier joint stocké sur Cloudflare R2. Remplace l'ancien
// service statique de /public/uploads (disque non persistant sur Workers).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const key = path.join("/");

  const { env } = getCloudflareContext();
  const object = await env.UPLOADS.get(key);
  if (!object) {
    return new Response("Fichier introuvable.", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");

  return new Response(object.body, { headers });
}
