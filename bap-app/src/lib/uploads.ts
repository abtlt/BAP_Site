import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { randomUUID } from "node:crypto";

// Stockage des fichiers joints sur Cloudflare R2 (le système de fichiers
// d'un Worker n'est pas persistant, on ne peut plus écrire sur disque).
// Les fichiers sont relus via la route /api/uploads/[...path].
export async function saveUploadedFile(articleId: string, file: File) {
  const { env } = getCloudflareContext();

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
  const { env } = getCloudflareContext();
  const listed = await env.UPLOADS.list({ prefix: `${articleId}/` });
  await Promise.all(listed.objects.map((obj: { key: string }) => env.UPLOADS.delete(obj.key)));
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
