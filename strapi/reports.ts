/**
 * Reports (Strapi).
 */

import type {StrapiCredentials} from "./client";
import {strapiRequest, unwrapDataArray, unwrapOne} from "./client";
import {fetchPropertyIfOwned} from "./access";
import {mapReportToClient} from "./mappers";

/**
 * @param {StrapiCredentials} creds Strapi credentials.
 * @param {string} appProfileDocumentId Owner profile documentId.
 * @param {Record<string, unknown>} input Create body from client.
 * @return {Promise<Record<string, unknown>>} Created report.
 */
export async function createReport(
  creds: StrapiCredentials,
  appProfileDocumentId: string,
  input: {
    property?: string;
    report_type?: string;
    status?: string;
    snapshot_json?: unknown;
    context_state_code?: string;
    disclaimer_version?: string;
  }
): Promise<Record<string, unknown>> {
  if (!input.property || !input.report_type || !input.status ||
      input.snapshot_json === undefined) {
    throw new Error("VALIDATION");
  }
  if (!(await fetchPropertyIfOwned(
    creds,
    appProfileDocumentId,
    input.property
  ))) {
    throw new Error("NOT_FOUND");
  }
  const data: Record<string, unknown> = {
    property: {connect: [input.property]},
    report_type: input.report_type,
    status: input.status,
    snapshot_json: input.snapshot_json,
    generated_at: new Date().toISOString(),
  };
  if (input.context_state_code) {
    data.context_state_code = input.context_state_code;
  }
  if (input.disclaimer_version) {
    data.disclaimer_version = input.disclaimer_version;
  }
  const resp = await strapiRequest(creds, "/api/reports", {
    method: "POST",
    body: JSON.stringify({data}),
  });
  const doc = unwrapOne(resp);
  if (!doc) {
    throw new Error("Strapi: create report failed");
  }
  return mapReportToClient(doc);
}

/**
 * @param {StrapiCredentials} creds Strapi credentials.
 * @param {string} appProfileDocumentId Owner profile documentId.
 * @param {string} propertyDocumentId Property documentId.
 * @return {Promise<Record<string, unknown>[]>} Reports for property.
 */
export async function listReportsForProperty(
  creds: StrapiCredentials,
  appProfileDocumentId: string,
  propertyDocumentId: string
): Promise<Record<string, unknown>[]> {
  if (!(await fetchPropertyIfOwned(
    creds,
    appProfileDocumentId,
    propertyDocumentId
  ))) {
    throw new Error("NOT_FOUND");
  }
  const pEnc = encodeURIComponent(propertyDocumentId);
  const path =
    `/api/reports?filters[property][documentId][$eq]=${pEnc}` +
    "&pagination[pageSize]=100&sort=createdAt:desc";
  const resp = await strapiRequest(creds, path);
  return unwrapDataArray(resp).map((d) => mapReportToClient(d));
}

/**
 * @param {StrapiCredentials} creds Strapi credentials.
 * @param {string} appProfileDocumentId Owner profile documentId.
 * @param {string} reportDocumentId Report documentId.
 * @return {Promise<Record<string, unknown>|null>} Report or null.
 */
export async function getReportById(
  creds: StrapiCredentials,
  appProfileDocumentId: string,
  reportDocumentId: string
): Promise<Record<string, unknown> | null> {
  const enc = encodeURIComponent(reportDocumentId);
  const resp = await strapiRequest(
    creds,
    `/api/reports/${enc}?populate[property][fields][0]=documentId`
  );
  const doc = unwrapOne(resp);
  if (!doc) {
    return null;
  }
  const prop = doc.property as {documentId?: string} | undefined;
  const propId = prop?.documentId;
  if (
    !propId ||
    !(await fetchPropertyIfOwned(creds, appProfileDocumentId, propId))
  ) {
    return null;
  }
  return mapReportToClient(doc);
}
