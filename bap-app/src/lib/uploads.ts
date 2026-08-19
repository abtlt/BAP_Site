import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { randomUUID } from "node:crypto";

// Stockage des fichiers joints sur Cloudflare R2 (le système de fichiers
// d'un Worker n'est pas persistant, on ne peut plus écrire sur disque).
// Les fichiers sont relus via la route /api/uploads/[...path].
//
// On utilise systématiquement la variante async de getCloudflareContext()
// ici : la variante synchrone peut échouer silencieusement quand elle est
// appelée (même indirectement) depuis une Server Action déclenchée sur une
// route dynamique (ex. /redaction/[id]) après une lecture de flux (upload
// de fichier) — bug connu de @opennextjs/cloudflare avec getCloudflareContext
// dans ce genre de scénario. La variante async est robuste dans tous les cas.
export async function saveUploadedFile(articleId: string, file: File) {
  const { env } = await getCloudflareContext({ async: true });

  const dotIndex = file.name.lastIndexOf(".");
  const ext = dotIndex > -1 ? file.name.slice(dotIndex) : "";
  const safeName = `${randomUUID()}${ext}`;
  const key = `${articleId}/${safeName}`;

  const buffer = await file.arrayBuffer();
  await env.UPLOADS.put(key, buffer, {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
  });

  return {
    filename: file.name,
    url: `/api/uploads/${key}`,
    size: buffer.byteLength,
  };
}

// Supprime tous les fichiers joints d'un article (utilisé notamment
// lors de la suppression de l'article par un administrateur).
export async function deleteArticleUploads(articleId: string) {
  const { env } = await getCloudflareContext({ async: true });
  const listed = await env.UPLOADS.list({ prefix: `${articleId}/` });
  await Promise.all(listed.objects.map((obj: { key: string }) => env.UPLOADS.delete(obj.key)));
}

// Supprime un unique fichier joint (retrait manuel par le journaliste ou
// un administrateur).
export async function deleteUploadedFile(key: string) {
  const { env } = await getCloudflareContext({ async: true });
  await env.UPLOADS.delete(key);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".avif"];

// Détermine si un fichier joint est une image (affichable directement)
// à partir de son nom, pour l'aperçu dans le fil de publications.
export function isImageFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
