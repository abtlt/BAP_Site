import "server-only";
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

// Stockage simple sur disque, adapté à un déploiement auto-hébergé
// (VPS, Docker) où le système de fichiers persiste. Pour un déploiement
// serverless (Vercel...), remplacez ceci par un stockage objet (S3,
// Cloudflare R2, Supabase Storage...).
const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");

export async function saveUploadedFile(articleId: string, file: File) {
  const dir = path.join(UPLOADS_ROOT, articleId);
  await mkdir(dir, { recursive: true });

  const ext = path.extname(file.name) || "";
  const safeName = `${randomUUID()}${ext}`;
  const filePath = path.join(dir, safeName);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  return {
    filename: file.name,
    url: `/uploads/${articleId}/${safeName}`,
    size: buffer.byteLength,
  };
}

// Supprime tous les fichiers joints d'un article (utilisé notamment
// lors de la suppression de l'article par un administrateur).
export async function deleteArticleUploads(articleId: string) {
  const dir = path.join(UPLOADS_ROOT, articleId);
  await rm(dir, { recursive: true, force: true });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
