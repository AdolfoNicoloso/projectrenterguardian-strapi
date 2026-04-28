/**
 * Space CRUD (Strapi).
 */

import type {StrapiCredentials} from "./client";
import {strapiRequest, unwrapDataArray, unwrapOne} from "./client";
import {fetchPropertyIfOwned} from "./access";
import {mapSpaceToClient} from "./mappers";

const VALID_SPACE_TYPES = [
  "living_room",
  "kitchen",
  "hallway",
  "bedroom",
  "bathroom",
  "garage",
  "dining_room",
  "custom_space_type",
];

/**
 * @param {StrapiCredentials} creds Strapi credentials.
 * @param {string} appProfileDocumentId Owner profile documentId.
 * @param {string} propertyDocumentId Property documentId.
 * @return {Promise<Record<string, unknown>[]>} Client-shaped spaces.
 */
export async function listSpacesForProperty(
  creds: StrapiCredentials,
  appProfileDocumentId: string,
  propertyDocumentId: string
): Promise<Record<string, unknown>[]> {
  const owned = await fetchPropertyIfOwned(
    creds,
    appProfileDocumentId,
    propertyDocumentId
  );
  if (!owned) {
    throw new Error("NOT_FOUND");
  }
  const pEnc = encodeURIComponent(propertyDocumentId);
  const path =
    `/api/spaces?filters[property][documentId][$eq]=${pEnc}` +
    "&pagination[pageSize]=200&sort=ordinal:asc";
  const resp = await strapiRequest(creds, path);
  return unwrapDataArray(resp).map((d) => mapSpaceToClient(d));
}

/**
 * @param {StrapiCredentials} creds Strapi credentials.
 * @param {string} appProfileDocumentId Owner profile documentId.
 * @param {Record<string, unknown>} input Client body.
 * @return {Promise<Record<string, unknown>>} Created space.
 */
export async function createSpaceForProperty(
  creds: StrapiCredentials,
  appProfileDocumentId: string,
  input: {
    property?: string;
    space_type?: string;
    display_name?: string;
    custom_space_type?: string;
  }
): Promise<Record<string, unknown>> {
  if (!input.property || !input.space_type || !input.display_name) {
    throw new Error("VALIDATION");
  }
  if (!VALID_SPACE_TYPES.includes(input.space_type)) {
    throw new Error("BAD_SPACE_TYPE");
  }
  const owned = await fetchPropertyIfOwned(
    creds,
    appProfileDocumentId,
    input.property
  );
  if (!owned) {
    throw new Error("NOT_FOUND");
  }
  const data: Record<string, unknown> = {
    property: {connect: [input.property]},
    space_type: input.space_type,
    display_name: String(input.display_name).trim(),
  };
  if (input.space_type === "custom_space_type" && input.custom_space_type) {
    data.custom_space_type = String(input.custom_space_type).trim();
  }
  const resp = await strapiRequest(creds, "/api/spaces", {
    method: "POST",
    body: JSON.stringify({data}),
  });
  const doc = unwrapOne(resp);
  if (!doc) {
    throw new Error("Strapi: create space failed");
  }
  return mapSpaceToClient(doc);
}

/**
 * @param {StrapiCredentials} creds Strapi credentials.
 * @param {string} appProfileDocumentId Owner profile documentId.
 * @param {string} spaceDocumentId Space documentId.
 * @param {Record<string, unknown>} patch Fields to update.
 * @return {Promise<Record<string, unknown>>} Updated space.
 */
export async function updateSpaceForProfile(
  creds: StrapiCredentials,
  appProfileDocumentId: string,
  spaceDocumentId: string,
  patch: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const enc = encodeURIComponent(spaceDocumentId);
  const cur = await strapiRequest(
    creds,
    `/api/spaces/${enc}?populate[property][fields][0]=documentId`
  );
  const doc = unwrapOne(cur);
  if (!doc) {
    throw new Error("NOT_FOUND");
  }
  const propId = typeof doc.property === "object" && doc.property &&
    "documentId" in doc.property ?
    String((doc.property as {documentId: string}).documentId) : "";
  if (
    !propId ||
    !(await fetchPropertyIfOwned(creds, appProfileDocumentId, propId))
  ) {
    throw new Error("NOT_FOUND");
  }
  const data: Record<string, unknown> = {};
  if (patch.space_type !== undefined) {
    data.space_type = patch.space_type;
  }
  if (patch.display_name !== undefined) {
    data.display_name = patch.display_name;
  }
  if (patch.custom_space_type !== undefined) {
    data.custom_space_type = patch.custom_space_type;
  }
  if (patch.ordinal !== undefined) {
    data.ordinal = patch.ordinal;
  }
  if (patch.is_default !== undefined) {
    data.is_default = patch.is_default;
  }
  const resp = await strapiRequest(creds, `/api/spaces/${enc}`, {
    method: "PATCH",
    body: JSON.stringify({data}),
  });
  const updated = unwrapOne(resp);
  if (!updated) {
    throw new Error("Strapi: update space failed");
  }
  return mapSpaceToClient(updated);
}

/**
 * @param {StrapiCredentials} creds Strapi credentials.
 * @param {string} appProfileDocumentId Owner profile documentId.
 * @param {string} spaceDocumentId Space documentId.
 * @return {Promise<boolean>} True if deleted.
 */
export async function deleteSpaceForProfile(
  creds: StrapiCredentials,
  appProfileDocumentId: string,
  spaceDocumentId: string
): Promise<boolean> {
  const enc = encodeURIComponent(spaceDocumentId);
  const cur = await strapiRequest(
    creds,
    `/api/spaces/${enc}?populate[property][fields][0]=documentId`
  );
  const doc = unwrapOne(cur);
  if (!doc) {
    return false;
  }
  const propId = typeof doc.property === "object" && doc.property &&
    "documentId" in doc.property ?
    String((doc.property as {documentId: string}).documentId) : "";
  if (
    !propId ||
    !(await fetchPropertyIfOwned(creds, appProfileDocumentId, propId))
  ) {
    return false;
  }
  await strapiRequest(creds, `/api/spaces/${enc}`, {method: "DELETE"});
  return true;
}

/**
 * @param {StrapiCredentials} creds Strapi credentials.
 * @param {string} appProfileDocumentId Owner profile documentId.
 * @param {string} propertyDocumentId Property documentId.
 * @return {Promise<boolean>} Whether any inspections exist.
 */
export async function propertyHasInspections(
  creds: StrapiCredentials,
  appProfileDocumentId: string,
  propertyDocumentId: string
): Promise<boolean> {
  if (!(await fetchPropertyIfOwned(
    creds,
    appProfileDocumentId,
    propertyDocumentId
  ))) {
    return false;
  }
  const pEnc = encodeURIComponent(propertyDocumentId);
  const path =
    `/api/inspections?filters[property][documentId][$eq]=${pEnc}` +
    "&pagination[pageSize]=1";
  const resp = await strapiRequest(creds, path);
  return unwrapDataArray(resp).length > 0;
}
