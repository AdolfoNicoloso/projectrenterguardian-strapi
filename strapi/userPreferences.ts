/**
 * User preferences (Strapi `user-preference`).
 */

import type {StrapiCredentials} from "./client";
import {strapiRequest, unwrapDataArray, unwrapOne} from "./client";
import {mapUserPreferenceToClient} from "./mappers";

/**
 * @param {StrapiCredentials} creds Strapi credentials.
 * @param {string} appProfileDocumentId App profile documentId.
 * @return {Promise<Record<string, unknown>|null>} Preferences or null.
 */
export async function getUserPreferences(
  creds: StrapiCredentials,
  appProfileDocumentId: string
): Promise<Record<string, unknown> | null> {
  const enc = encodeURIComponent(appProfileDocumentId);
  const path =
    `/api/user-preferences?filters[app_profile][documentId][$eq]=${enc}` +
    "&pagination[pageSize]=1";
  const resp = await strapiRequest(creds, path);
  const doc = unwrapDataArray(resp)[0] ?? null;
  return doc ? mapUserPreferenceToClient(doc) : null;
}

/**
 * @param {StrapiCredentials} creds Strapi credentials.
 * @param {string} appProfileDocumentId App profile documentId.
 * @param {Record<string, unknown>} input Theme / language updates.
 * @return {Promise<Record<string, unknown>>} Upserted preferences.
 */
export async function upsertUserPreferences(
  creds: StrapiCredentials,
  appProfileDocumentId: string,
  input: {theme_preference?: string; preferred_language?: string}
): Promise<Record<string, unknown>> {
  const existing = await getUserPreferences(creds, appProfileDocumentId);
  if (existing && existing.id) {
    const data: Record<string, unknown> = {};
    if (input.theme_preference !== undefined) {
      data.theme_preference = input.theme_preference;
    }
    if (input.preferred_language !== undefined) {
      data.preferred_language = input.preferred_language;
    }
    const enc = encodeURIComponent(String(existing.id));
    const resp = await strapiRequest(creds, `/api/user-preferences/${enc}`, {
      method: "PATCH",
      body: JSON.stringify({data}),
    });
    const doc = unwrapOne(resp);
    if (!doc) {
      throw new Error("Strapi: update preferences failed");
    }
    return mapUserPreferenceToClient(doc);
  }
  const data: Record<string, unknown> = {
    app_profile: {connect: [appProfileDocumentId]},
    theme_preference: input.theme_preference || "auto",
  };
  if (input.preferred_language !== undefined) {
    data.preferred_language = input.preferred_language;
  }
  const resp = await strapiRequest(creds, "/api/user-preferences", {
    method: "POST",
    body: JSON.stringify({data}),
  });
  const doc = unwrapOne(resp);
  if (!doc) {
    throw new Error("Strapi: create preferences failed");
  }
  return mapUserPreferenceToClient(doc);
}
