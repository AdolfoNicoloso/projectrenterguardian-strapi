/**
 * App profile bootstrap and profile CRUD (Strapi `app-profile`).
 */

import type {StrapiCredentials} from "./client";
import {strapiRequest, unwrapDataArray, unwrapOne} from "./client";
import {mapAppProfileToClient} from "./mappers";

/**
 * Finds or creates an app profile for a Firebase user.
 * @param {StrapiCredentials} creds Strapi credentials.
 * @param {object} params Firebase user fields.
 * @param {string} params.uid Firebase UID.
 * @param {string|null} params.email Email or null.
 * @param {string|null} params.name Display name or null.
 * @return {Promise<string>} App profile documentId.
 */
export async function getOrCreateAppProfile(
  creds: StrapiCredentials,
  params: {uid: string; email: string | null; name: string | null}
): Promise<string> {
  const q = encodeURIComponent(params.uid);
  const found = await strapiRequest(
    creds,
    `/api/app-profiles?filters[firebase_uid][$eq]=${q}&pagination[pageSize]=1`
  );
  const rows = unwrapDataArray(found);
  if (rows.length > 0 && rows[0].documentId) {
    return rows[0].documentId;
  }

  const created = await strapiRequest(creds, "/api/app-profiles", {
    method: "POST",
    body: JSON.stringify({
      data: {
        firebase_uid: params.uid,
        name: params.name ?? undefined,
        onboarding_completed: false,
      },
    }),
  });
  const doc = unwrapOne(created);
  if (!doc?.documentId) {
    throw new Error("Strapi: failed to create app-profile");
  }
  return doc.documentId;
}

/**
 * Looks up an app profile by Firebase UID (does not create).
 * @param {StrapiCredentials} creds Strapi credentials.
 * @param {string} firebaseUid Firebase user UID.
 * @return {Promise<Record<string, unknown>|null>} Mapped profile or null.
 */
export async function findAppProfileByFirebaseUid(
  creds: StrapiCredentials,
  firebaseUid: string
): Promise<Record<string, unknown> | null> {
  const q = encodeURIComponent(firebaseUid);
  const resp = await strapiRequest(
    creds,
    `/api/app-profiles?filters[firebase_uid][$eq]=${q}&pagination[pageSize]=1`
  );
  const doc = unwrapDataArray(resp)[0] ?? null;
  return doc ? mapAppProfileToClient(doc) : null;
}

/**
 * Returns the current user's app profile row.
 * @param {StrapiCredentials} creds Strapi credentials.
 * @param {string} appProfileDocumentId Profile documentId.
 * @return {Promise<Record<string, unknown>|null>} Mapped profile or null.
 */
export async function getAppProfile(
  creds: StrapiCredentials,
  appProfileDocumentId: string
): Promise<Record<string, unknown> | null> {
  const enc = encodeURIComponent(appProfileDocumentId);
  const resp = await strapiRequest(creds, `/api/app-profiles/${enc}`);
  const doc = unwrapOne(resp);
  return doc ? mapAppProfileToClient(doc) : null;
}

/**
 * Updates app profile fields allowed by the client.
 * @param {StrapiCredentials} creds Strapi credentials.
 * @param {string} appProfileDocumentId Profile documentId.
 * @param {Record<string, unknown>} updates Partial updates.
 * @return {Promise<Record<string, unknown>>} Updated mapped profile.
 */
export async function updateAppProfile(
  creds: StrapiCredentials,
  appProfileDocumentId: string,
  updates: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = {};
  if (updates.name !== undefined) {
    data.name = updates.name;
  }
  if (updates.onboarding_completed !== undefined) {
    data.onboarding_completed = updates.onboarding_completed;
  }
  const enc = encodeURIComponent(appProfileDocumentId);
  const resp = await strapiRequest(creds, `/api/app-profiles/${enc}`, {
    method: "PATCH",
    body: JSON.stringify({data}),
  });
  const doc = unwrapOne(resp);
  if (!doc) {
    throw new Error("Strapi: update app-profile returned no data");
  }
  return mapAppProfileToClient(doc);
}
