/**
 * Low-level Strapi 5 Content API client (Bearer API token).
 */

export interface StrapiCredentials {
  baseUrl: string;
  token: string;
}

/** Flattened Strapi 5 document (REST). */
export interface StrapiDocument {
  id: number;
  documentId: string;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string | null;
  [key: string]: unknown;
}

export interface StrapiListResponse {
  data: StrapiDocument[];
  meta?: {pagination?: {total?: number; pageCount?: number}};
}

export interface StrapiSingleResponse {
  data: StrapiDocument;
}

/**
 * Authenticated JSON request to Strapi.
 * @param {StrapiCredentials} creds Base URL (no trailing slash) and token.
 * @param {string} pathAndQuery Absolute path including query string.
 * @param {RequestInit} options Fetch options.
 * @return {Promise<unknown>} Parsed JSON or null for empty body.
 */
export async function strapiRequest(
  creds: StrapiCredentials,
  pathAndQuery: string,
  options: RequestInit = {}
): Promise<unknown> {
  const path = pathAndQuery.startsWith("/") ? pathAndQuery : `/${pathAndQuery}`;
  const url = `${creds.baseUrl}${path}`;
  const method = options.method || "GET";
  const headers: Record<string, string> = {
    Authorization: `Bearer ${creds.token}`,
    ...((options.headers as Record<string, string>) || {}),
  };
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(url, {...options, method, headers});
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`Strapi ${method} ${path}: ${res.status} ${text}`);
  }
  if (!text || text.trim() === "") {
    return null;
  }
  return JSON.parse(text) as unknown;
}

/**
 * Unwraps Strapi list or single-item `data` payload to an array.
 * @param {unknown} resp Parsed Strapi response.
 * @return {StrapiDocument[]} Zero or more documents.
 */
export function unwrapDataArray(resp: unknown): StrapiDocument[] {
  const r = resp as {data?: StrapiDocument | StrapiDocument[]};
  if (r.data == null) {
    return [];
  }
  return Array.isArray(r.data) ? r.data : [r.data];
}

/**
 * Returns the first document from a list response.
 * @param {unknown} resp Parsed Strapi response.
 * @return {StrapiDocument|null} First row or null.
 */
export function unwrapOne(resp: unknown): StrapiDocument | null {
  const rows = unwrapDataArray(resp);
  return rows[0] ?? null;
}
