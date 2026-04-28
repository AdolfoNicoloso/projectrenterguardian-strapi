/**
 * Inspections and inspection steps (Strapi).
 */

import type {StrapiCredentials} from "./client";
import {strapiRequest, unwrapDataArray, unwrapOne} from "./client";
import {fetchPropertyIfOwned} from "./access";
import {mapInspectionStepToClient, mapInspectionToClient} from "./mappers";

const STEP_KEYS = [
  "intro",
  "choose_property",
  "confirm_scope",
  "capture_overview",
  "capture_spaces",
  "review",
  "complete",
];

/**
 * @param {StrapiCredentials} creds Strapi credentials.
 * @param {string} appProfileDocumentId Owner profile documentId.
 * @param {string} propertyDocumentId Property documentId.
 * @param {string} inspectionType Inspection type string.
 * @return {Promise<Record<string, unknown>>} Created inspection (client shape).
 */
export async function createInspection(
  creds: StrapiCredentials,
  appProfileDocumentId: string,
  propertyDocumentId: string,
  inspectionType: string
): Promise<Record<string, unknown>> {
  if (!(await fetchPropertyIfOwned(
    creds,
    appProfileDocumentId,
    propertyDocumentId
  ))) {
    throw new Error("NOT_FOUND");
  }
  const now = new Date().toISOString();
  const body = {
    data: {
      property: {connect: [propertyDocumentId]},
      created_by_user_id: appProfileDocumentId,
      inspection_status: "in_progress",
      inspection_type: inspectionType,
      started_at: now,
      completed_at: null,
      last_step: null,
      inspections_progress: 0,
    },
  };
  const resp = await strapiRequest(creds, "/api/inspections", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const doc = unwrapOne(resp);
  if (!doc?.documentId) {
    throw new Error("Strapi: create inspection failed");
  }
  const inspectionDocId = doc.documentId;
  for (let i = 0; i < STEP_KEYS.length; i++) {
    const stepKey = STEP_KEYS[i];
    await strapiRequest(creds, "/api/inspection-steps", {
      method: "POST",
      body: JSON.stringify({
        data: {
          inspection: {connect: [inspectionDocId]},
          step_key: stepKey,
          inspection_step_status: i === 0 ? "in_progress" : "not_started",
          payload_json: {},
        },
      }),
    });
  }
  const full = await strapiRequest(
    creds,
    `/api/inspections/${encodeURIComponent(inspectionDocId)}`
  );
  const out = unwrapOne(full);
  return out ? mapInspectionToClient(out) : mapInspectionToClient(doc);
}

/**
 * @param {StrapiCredentials} creds Strapi credentials.
 * @param {string} appProfileDocumentId Owner profile documentId.
 * @param {string|undefined} status Optional status filter.
 * @return {Promise<Record<string, unknown>[]>} Inspections.
 */
export async function listInspections(
  creds: StrapiCredentials,
  appProfileDocumentId: string,
  status?: string
): Promise<Record<string, unknown>[]> {
  let path =
    "/api/inspections?filters[created_by_user_id][$eq]=" +
    encodeURIComponent(appProfileDocumentId) +
    "&pagination[pageSize]=200&sort=createdAt:desc";
  if (status) {
    path +=
      `&filters[inspection_status][$eq]=${encodeURIComponent(status)}`;
  }
  const resp = await strapiRequest(creds, path);
  return unwrapDataArray(resp).map((d) => mapInspectionToClient(d));
}

/**
 * @param {StrapiCredentials} creds Strapi credentials.
 * @param {string} appProfileDocumentId Owner profile documentId.
 * @param {string} inspectionDocumentId Inspection documentId.
 * @return {Promise<Record<string, unknown>|null>} Inspection or null.
 */
export async function getInspectionById(
  creds: StrapiCredentials,
  appProfileDocumentId: string,
  inspectionDocumentId: string
): Promise<Record<string, unknown> | null> {
  const iEnc = encodeURIComponent(inspectionDocumentId);
  const aEnc = encodeURIComponent(appProfileDocumentId);
  const path =
    `/api/inspections?filters[documentId][$eq]=${iEnc}` +
    `&filters[created_by_user_id][$eq]=${aEnc}&pagination[pageSize]=1`;
  const resp = await strapiRequest(creds, path);
  const doc = unwrapDataArray(resp)[0] ?? null;
  return doc ? mapInspectionToClient(doc) : null;
}

/**
 * @param {StrapiCredentials} creds Strapi credentials.
 * @param {string} appProfileDocumentId Owner profile documentId.
 * @param {string} inspectionDocumentId Inspection documentId.
 * @return {Promise<Record<string, unknown>[]>} Steps (client shape).
 */
export async function listInspectionSteps(
  creds: StrapiCredentials,
  appProfileDocumentId: string,
  inspectionDocumentId: string
): Promise<Record<string, unknown>[]> {
  if (!(await getInspectionById(
    creds,
    appProfileDocumentId,
    inspectionDocumentId
  ))) {
    throw new Error("NOT_FOUND");
  }
  const iEnc = encodeURIComponent(inspectionDocumentId);
  const path =
    `/api/inspection-steps?filters[inspection][documentId][$eq]=${iEnc}` +
    "&pagination[pageSize]=50&sort=createdAt:asc";
  const resp = await strapiRequest(creds, path);
  return unwrapDataArray(resp).map((d) => mapInspectionStepToClient(d));
}

/**
 * @param {StrapiCredentials} creds Strapi credentials.
 * @param {string} appProfileDocumentId Owner profile documentId.
 * @param {string} inspectionDocumentId Inspection documentId.
 * @param {string} stepKey Step key.
 * @return {Promise<Record<string, unknown>|null>} Step or null.
 */
export async function getInspectionStep(
  creds: StrapiCredentials,
  appProfileDocumentId: string,
  inspectionDocumentId: string,
  stepKey: string
): Promise<Record<string, unknown> | null> {
  if (!(await getInspectionById(
    creds,
    appProfileDocumentId,
    inspectionDocumentId
  ))) {
    return null;
  }
  const iEnc = encodeURIComponent(inspectionDocumentId);
  const kEnc = encodeURIComponent(stepKey);
  const path =
    `/api/inspection-steps?filters[inspection][documentId][$eq]=${iEnc}` +
    `&filters[step_key][$eq]=${kEnc}&pagination[pageSize]=1`;
  const resp = await strapiRequest(creds, path);
  const doc = unwrapDataArray(resp)[0] ?? null;
  return doc ? mapInspectionStepToClient(doc) : null;
}

/**
 * @param {StrapiCredentials} creds Strapi credentials.
 * @param {string} appProfileDocumentId Owner profile documentId.
 * @param {string} stepDocumentId Step documentId.
 * @param {Record<string, unknown>} patch payload_json / status.
 * @return {Promise<Record<string, unknown>>} Updated step.
 */
export async function updateInspectionStep(
  creds: StrapiCredentials,
  appProfileDocumentId: string,
  stepDocumentId: string,
  patch: {payload_json?: unknown; inspection_step_status?: string}
): Promise<Record<string, unknown>> {
  const sEnc = encodeURIComponent(stepDocumentId);
  const stepResp = await strapiRequest(
    creds,
    `/api/inspection-steps/${sEnc}?populate[inspection][fields][0]=documentId` +
      "&populate[inspection][fields][1]=created_by_user_id"
  );
  const step = unwrapOne(stepResp);
  if (!step) {
    throw new Error("NOT_FOUND");
  }
  const insp = step.inspection as {documentId?: string} | undefined;
  const inspectionDocId = insp?.documentId;
  if (!inspectionDocId) {
    throw new Error("NOT_FOUND");
  }
  const owned = await getInspectionById(
    creds,
    appProfileDocumentId,
    inspectionDocId
  );
  if (!owned) {
    throw new Error("NOT_FOUND");
  }
  const data: Record<string, unknown> = {};
  if (patch.payload_json !== undefined) {
    data.payload_json = patch.payload_json;
  }
  if (patch.inspection_step_status !== undefined) {
    data.inspection_step_status = patch.inspection_step_status;
  }
  const resp = await strapiRequest(creds, `/api/inspection-steps/${sEnc}`, {
    method: "PATCH",
    body: JSON.stringify({data}),
  });
  const doc = unwrapOne(resp);
  if (!doc) {
    throw new Error("Strapi: update step failed");
  }
  return mapInspectionStepToClient(doc);
}

/**
 * @param {StrapiCredentials} creds Strapi credentials.
 * @param {string} appProfileDocumentId Owner profile documentId.
 * @param {string} inspectionDocumentId Inspection documentId.
 * @param {Record<string, unknown>} patch Partial inspection fields.
 * @return {Promise<Record<string, unknown>>} Updated inspection.
 */
export async function updateInspection(
  creds: StrapiCredentials,
  appProfileDocumentId: string,
  inspectionDocumentId: string,
  patch: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (!(await getInspectionById(
    creds,
    appProfileDocumentId,
    inspectionDocumentId
  ))) {
    throw new Error("NOT_FOUND");
  }
  const data: Record<string, unknown> = {};
  if (patch.last_step !== undefined) {
    data.last_step = patch.last_step;
  }
  if (patch.inspections_progress !== undefined) {
    data.inspections_progress = patch.inspections_progress;
  }
  if (patch.inspection_status !== undefined) {
    data.inspection_status = patch.inspection_status;
  }
  if (patch.completed_at !== undefined) {
    data.completed_at = patch.completed_at;
  }
  const enc = encodeURIComponent(inspectionDocumentId);
  const resp = await strapiRequest(creds, `/api/inspections/${enc}`, {
    method: "PATCH",
    body: JSON.stringify({data}),
  });
  const doc = unwrapOne(resp);
  if (!doc) {
    throw new Error("Strapi: update inspection failed");
  }
  return mapInspectionToClient(doc);
}
