/**
 * Property CRUD and cascade delete (Strapi).
 */

import type {StrapiCredentials} from "./client";
import {strapiRequest, unwrapDataArray, unwrapOne} from "./client";
import {fetchPropertyIfOwned} from "./access";
import {mapPropertyToClient} from "./mappers";

/**
 * Default spaces for each new property (matches Directus-era behavior).
 */
const DEFAULT_SPACES: Array<{
  display_name: string;
  space_type: string;
  ordinal: number;
  is_default: boolean;
}> = [
  {
    display_name: "Bedroom 1",
    space_type: "bedroom",
    ordinal: 10,
    is_default: true,
  },
  {
    display_name: "Bathroom 1",
    space_type: "bathroom",
    ordinal: 20,
    is_default: true,
  },
  {
    display_name: "Kitchen",
    space_type: "kitchen",
    ordinal: 30,
    is_default: true,
  },
  {
    display_name: "Living Room",
    space_type: "living_room",
    ordinal: 40,
    is_default: true,
  },
];

/**
 * @param {StrapiCredentials} creds Strapi credentials.
 * @param {string} appProfileDocumentId Owner profile documentId.
 * @return {Promise<Record<string, unknown>[]>} Client-shaped properties.
 */
export async function listPropertiesForAppProfile(
  creds: StrapiCredentials,
  appProfileDocumentId: string
): Promise<Record<string, unknown>[]> {
  const idEnc = encodeURIComponent(appProfileDocumentId);
  const path =
    `/api/properties?filters[app_profile][documentId][$eq]=${idEnc}` +
    "&pagination[pageSize]=100&sort=createdAt:desc";
  const resp = await strapiRequest(creds, path);
  return unwrapDataArray(resp).map((doc) =>
    mapPropertyToClient(doc, appProfileDocumentId)
  );
}

/**
 * @param {StrapiCredentials} creds Strapi credentials.
 * @param {string} appProfileDocumentId Owner profile documentId.
 * @param {string} propertyDocumentId Property documentId.
 * @return {Promise<Record<string, unknown>|null>} Client property or null.
 */
export async function getPropertyForAppProfile(
  creds: StrapiCredentials,
  appProfileDocumentId: string,
  propertyDocumentId: string
): Promise<Record<string, unknown> | null> {
  const row = await fetchPropertyIfOwned(
    creds,
    appProfileDocumentId,
    propertyDocumentId
  );
  if (!row) {
    return null;
  }
  return mapPropertyToClient(row as never, appProfileDocumentId);
}

/**
 * @param {StrapiCredentials} creds Strapi credentials.
 * @param {string} appProfileDocumentId Owner profile documentId.
 * @param {Record<string, unknown>} input Create payload from client.
 * @return {Promise<Record<string, unknown>>} Created property (Directus shape).
 */
export async function createPropertyWithDefaultSpaces(
  creds: StrapiCredentials,
  appProfileDocumentId: string,
  input: {
    address_free_text: string;
    lease_start_date: string;
    lease_end_date?: string | null;
    lease_term?: number | null;
    nickname?: string | null;
    state_code?: string | null;
    street?: string | null;
    unit?: string | null;
    city?: string | null;
    zip?: number | null;
  }
): Promise<Record<string, unknown>> {
  const body = {
    data: {
      address_free_text: input.address_free_text,
      lease_start_date: input.lease_start_date,
      lease_end_date: input.lease_end_date ?? null,
      lease_term: input.lease_term ?? null,
      nickname: input.nickname && String(input.nickname).trim() ?
        String(input.nickname).trim() : null,
      state_code: input.state_code ?? null,
      street: input.street ?? null,
      unit: input.unit ?? null,
      city: input.city ?? null,
      zip: input.zip ?? null,
      status: "active",
      app_profile: {connect: [appProfileDocumentId]},
    },
  };
  const resp = await strapiRequest(creds, "/api/properties", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const doc = unwrapOne(resp);
  if (!doc?.documentId) {
    throw new Error("Strapi: create property failed");
  }
  const propertyDocId = doc.documentId;
  for (const sp of DEFAULT_SPACES) {
    try {
      await strapiRequest(creds, "/api/spaces", {
        method: "POST",
        body: JSON.stringify({
          data: {
            ...sp,
            property: {connect: [propertyDocId]},
          },
        }),
      });
    } catch {
      // Same as Directus path: property exists even if a default space fails.
    }
  }
  return mapPropertyToClient(doc, appProfileDocumentId);
}

/**
 * @param {StrapiCredentials} creds Strapi credentials.
 * @param {string} appProfileDocumentId Owner profile documentId.
 * @param {string} propertyDocumentId Property documentId.
 * @param {Record<string, unknown>} patch Partial field updates.
 * @return {Promise<Record<string, unknown>>} Updated client property.
 */
export async function updatePropertyForAppProfile(
  creds: StrapiCredentials,
  appProfileDocumentId: string,
  propertyDocumentId: string,
  patch: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const owned = await fetchPropertyIfOwned(
    creds,
    appProfileDocumentId,
    propertyDocumentId
  );
  if (!owned) {
    throw new Error("NOT_FOUND");
  }
  const data: Record<string, unknown> = {};
  const keys = [
    "nickname",
    "address_free_text",
    "lease_start_date",
    "lease_end_date",
    "state_code",
    "status",
    "street",
    "unit",
    "city",
    "zip",
  ] as const;
  for (const k of keys) {
    if (patch[k] !== undefined) {
      data[k] = patch[k];
    }
  }
  const enc = encodeURIComponent(propertyDocumentId);
  const resp = await strapiRequest(creds, `/api/properties/${enc}`, {
    method: "PATCH",
    body: JSON.stringify({data}),
  });
  const doc = unwrapOne(resp);
  if (!doc) {
    throw new Error("Strapi: update property returned no data");
  }
  return mapPropertyToClient(doc, appProfileDocumentId);
}

/**
 * Deletes a property and dependent rows (no Directus Flow; explicit order).
 * @param {StrapiCredentials} creds Strapi credentials.
 * @param {string} appProfileDocumentId Owner profile documentId.
 * @param {string} propertyDocumentId Property documentId.
 * @return {Promise<boolean>} True if deleted; false if not owned.
 */
export async function deletePropertyCascade(
  creds: StrapiCredentials,
  appProfileDocumentId: string,
  propertyDocumentId: string
): Promise<boolean> {
  const owned = await fetchPropertyIfOwned(
    creds,
    appProfileDocumentId,
    propertyDocumentId
  );
  if (!owned) {
    return false;
  }
  const pEnc = encodeURIComponent(propertyDocumentId);

  const listByProp = async (apiPlural: string): Promise<string[]> => {
    const path =
      `/api/${apiPlural}?filters[property][documentId][$eq]=${pEnc}` +
      "&pagination[pageSize]=200";
    const r = await strapiRequest(creds, path);
    return unwrapDataArray(r).map((d) => d.documentId);
  };

  const photoIds = await listByProp("photos");
  for (const photoId of photoIds) {
    const phEnc = encodeURIComponent(photoId);
    const assigns = await strapiRequest(
      creds,
      `/api/photo-assignments?filters[photo][documentId][$eq]=${phEnc}` +
        "&pagination[pageSize]=100"
    );
    for (const a of unwrapDataArray(assigns)) {
      const aEnc = encodeURIComponent(a.documentId);
      await strapiRequest(creds, `/api/photo-assignments/${aEnc}`, {
        method: "DELETE",
      });
    }
    await strapiRequest(creds, `/api/photos/${phEnc}`, {method: "DELETE"});
  }

  const reportIds = await listByProp("reports");
  for (const id of reportIds) {
    await strapiRequest(creds, `/api/reports/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  const inspectionIds = await listByProp("inspections");
  for (const insId of inspectionIds) {
    const iEnc = encodeURIComponent(insId);
    const steps = await strapiRequest(
      creds,
      `/api/inspection-steps?filters[inspection][documentId][$eq]=${iEnc}` +
        "&pagination[pageSize]=100"
    );
    for (const s of unwrapDataArray(steps)) {
      await strapiRequest(
        creds,
        `/api/inspection-steps/${encodeURIComponent(s.documentId)}`,
        {method: "DELETE"}
      );
    }
    await strapiRequest(creds, `/api/inspections/${iEnc}`, {method: "DELETE"});
  }

  const spaceIds = await listByProp("spaces");
  for (const sid of spaceIds) {
    await strapiRequest(creds, `/api/spaces/${encodeURIComponent(sid)}`, {
      method: "DELETE",
    });
  }

  await strapiRequest(creds, `/api/properties/${pEnc}`, {method: "DELETE"});
  return true;
}
