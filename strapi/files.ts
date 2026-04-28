/**
 * Proxies uploaded files from Strapi (replaces Directus `/assets/:id`).
 */

import type {StrapiCredentials} from "./client";
import {strapiRequest, unwrapOne} from "./client";

export interface DownloadedFile {
  buffer: Buffer;
  contentType: string;
  filename?: string;
}

/**
 * Loads upload metadata then downloads bytes (authenticated).
 * @param {StrapiCredentials} creds Strapi credentials.
 * @param {string} fileDocumentId Upload `documentId` (or id string).
 * @return {Promise<DownloadedFile>} File bytes and MIME type.
 */
export async function downloadUpload(
  creds: StrapiCredentials,
  fileDocumentId: string
): Promise<DownloadedFile> {
  const enc = encodeURIComponent(fileDocumentId);
  const metaResp = await strapiRequest(creds, `/api/upload/files/${enc}`);
  const doc = unwrapOne(metaResp) as Record<string, unknown> | null;
  if (!doc) {
    throw new Error("FILE_NOT_FOUND");
  }
  const urlPath = (doc.url as string) || "";
  const mime = (doc.mime as string) || "application/octet-stream";
  const filename = doc.name as string | undefined;
  const absolute =
    urlPath.startsWith("http") ?
      urlPath :
      `${creds.baseUrl}${urlPath.startsWith("/") ? "" : "/"}${urlPath}`;
  const fileRes = await fetch(absolute, {
    headers: {Authorization: `Bearer ${creds.token}`},
  });
  if (!fileRes.ok) {
    const t = await fileRes.text().catch(() => "");
    throw new Error(`Strapi file fetch ${fileRes.status}: ${t}`);
  }
  const buf = Buffer.from(await fileRes.arrayBuffer());
  return {buffer: buf, contentType: mime, filename};
}
