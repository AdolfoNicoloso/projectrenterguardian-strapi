/**
 * Shared ownership checks against Strapi (property scoped to app profile).
 */

import type {StrapiCredentials} from "./client";
import {strapiRequest, unwrapDataArray, unwrapOne} from "./client";

/**
 * Returns true if the property document belongs to the app profile.
 * @param {StrapiCredentials} creds Strapi credentials.
 * @param {string} appProfileDocumentId App profile documentId.
 * @param {string} propertyDocumentId Property documentId.
 * @return {Promise<boolean>} Whether the property is owned.
 */
export async function isPropertyOwned(
  creds: StrapiCredentials,
  appProfileDocumentId: string,
  propertyDocumentId: string
): Promise<boolean> {
  const row = await fetchPropertyIfOwned(
    creds,
    appProfileDocumentId,
    propertyDocumentId
  );
  return row != null;
}

/**
 * Loads a property row if owned by the profile.
 * @param {StrapiCredentials} creds Strapi credentials.
 * @param {string} appProfileDocumentId App profile documentId.
 * @param {string} propertyDocumentId Property documentId.
 * @return {Promise<object|null>} Raw Strapi document or null.
 */
export async function fetchPropertyIfOwned(
  creds: StrapiCredentials,
  appProfileDocumentId: string,
  propertyDocumentId: string
): Promise<Record<string, unknown> | null> {
  const pEnc = encodeURIComponent(propertyDocumentId);
  const aEnc = encodeURIComponent(appProfileDocumentId);
  const path =
    `/api/properties?filters[documentId][$eq]=${pEnc}` +
    `&filters[app_profile][documentId][$eq]=${aEnc}` +
    "&pagination[pageSize]=1";
  const resp = await strapiRequest(creds, path);
  const rows = unwrapDataArray(resp);
  if (rows.length === 0) {
    return null;
  }
  return rows[0] as unknown as Record<string, unknown>;
}

/**
 * Verifies a space belongs to a property owned by the profile.
 * @param {StrapiCredentials} creds Strapi credentials.
 * @param {string} appProfileDocumentId App profile documentId.
 * @param {string} propertyDocumentId Property documentId.
 * @param {string} spaceDocumentId Space documentId.
 * @return {Promise<boolean>} Whether the link is valid.
 */
export async function isSpaceOnOwnedProperty(
  creds: StrapiCredentials,
  appProfileDocumentId: string,
  propertyDocumentId: string,
  spaceDocumentId: string
): Promise<boolean> {
  if (!(await isPropertyOwned(
    creds,
    appProfileDocumentId,
    propertyDocumentId
  ))) {
    return false;
  }
  const sEnc = encodeURIComponent(spaceDocumentId);
  const pEnc = encodeURIComponent(propertyDocumentId);
  const path =
    `/api/spaces?filters[documentId][$eq]=${sEnc}` +
    `&filters[property][documentId][$eq]=${pEnc}` +
    "&pagination[pageSize]=1";
  const resp = await strapiRequest(creds, path);
  return unwrapDataArray(resp).length > 0;
}

/**
 * Loads a photo document by documentId (no ownership check).
 * @param {StrapiCredentials} creds Strapi credentials.
 * @param {string} photoDocumentId Photo documentId.
 * @return {Promise<object|null>} Raw document or null.
 */
export async function fetchPhotoById(
  creds: StrapiCredentials,
  photoDocumentId: string
): Promise<Record<string, unknown> | null> {
  const enc = encodeURIComponent(photoDocumentId);
  const path =
    `/api/photos/${enc}?populate[property][fields][0]=documentId` +
    "&populate[space][fields][0]=documentId" +
    "&populate[file][fields][0]=documentId";
  const resp = await strapiRequest(creds, path);
  const doc = unwrapOne(resp);
  return doc ? (doc as unknown as Record<string, unknown>) : null;
}

/**
 * Resolves property documentId from a photo document (populated or id).
 * @param {Record<string, unknown>} photo Photo row.
 * @return {string|undefined} Property documentId.
 */
export function propertyIdFromPhoto(
  photo: Record<string, unknown>
): string | undefined {
  const p = photo.property;
  if (typeof p === "string") {
    return p;
  }
  if (p && typeof p === "object" && "documentId" in p) {
    return String((p as {documentId: string}).documentId);
  }
  return undefined;
}
