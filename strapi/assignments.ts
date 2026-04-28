/**
 * Photo–space assignments (Strapi `photo-assignment`).
 */

import type {StrapiCredentials} from "./client";
import {strapiRequest, unwrapDataArray, unwrapOne} from "./client";
import {
  fetchPhotoById,
  fetchPropertyIfOwned,
  propertyIdFromPhoto,
} from "./access";
import {mapAssignmentToClient} from "./mappers";

/**
 * @param {StrapiCredentials} creds Strapi credentials.
 * @param {string} appProfileDocumentId Owner profile documentId.
 * @param {string} photoDocumentId Photo documentId.
 * @param {string} spaceDocumentId Space documentId.
 * @return {Promise<Record<string, unknown>>} Created assignment.
 */
export async function createAssignment(
  creds: StrapiCredentials,
  appProfileDocumentId: string,
  photoDocumentId: string,
  spaceDocumentId: string
): Promise<Record<string, unknown>> {
  const raw = await fetchPhotoById(creds, photoDocumentId);
  if (!raw) {
    throw new Error("PHOTO_NOT_FOUND");
  }
  const photo = raw as Record<string, unknown>;
  const propertyId = propertyIdFromPhoto(photo);
  if (
    !propertyId ||
    !(await fetchPropertyIfOwned(creds, appProfileDocumentId, propertyId))
  ) {
    throw new Error("NOT_FOUND");
  }
  const pEnc = encodeURIComponent(propertyId);
  const sEnc = encodeURIComponent(spaceDocumentId);
  const spaceCheck = await strapiRequest(
    creds,
    `/api/spaces?filters[documentId][$eq]=${sEnc}` +
      `&filters[property][documentId][$eq]=${pEnc}&pagination[pageSize]=1`
  );
  if (unwrapDataArray(spaceCheck).length === 0) {
    throw new Error("BAD_SPACE");
  }
  const body = {
    data: {
      photo: {connect: [photoDocumentId]},
      space: {connect: [spaceDocumentId]},
      status: "confirmed",
      confirmed_by_app_profile: appProfileDocumentId,
      confirmed_at: new Date().toISOString(),
      method: "manual",
    },
  };
  const resp = await strapiRequest(creds, "/api/photo-assignments", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const doc = unwrapOne(resp);
  if (!doc) {
    throw new Error("Strapi: create assignment failed");
  }
  return mapAssignmentToClient(doc);
}

/**
 * @param {StrapiCredentials} creds Strapi credentials.
 * @param {string} appProfileDocumentId Owner profile documentId.
 * @param {string} photoDocumentId Photo documentId.
 * @return {Promise<Record<string, unknown>[]>} Assignments for photo.
 */
export async function listAssignmentsForPhoto(
  creds: StrapiCredentials,
  appProfileDocumentId: string,
  photoDocumentId: string
): Promise<Record<string, unknown>[]> {
  const raw = await fetchPhotoById(creds, photoDocumentId);
  if (!raw) {
    throw new Error("PHOTO_NOT_FOUND");
  }
  const photo = raw as Record<string, unknown>;
  const propertyId = propertyIdFromPhoto(photo);
  if (
    !propertyId ||
    !(await fetchPropertyIfOwned(creds, appProfileDocumentId, propertyId))
  ) {
    throw new Error("NOT_FOUND");
  }
  const phEnc = encodeURIComponent(photoDocumentId);
  const path =
    `/api/photo-assignments?filters[photo][documentId][$eq]=${phEnc}` +
    "&pagination[pageSize]=100";
  const resp = await strapiRequest(creds, path);
  return unwrapDataArray(resp).map((d) => mapAssignmentToClient(d));
}
