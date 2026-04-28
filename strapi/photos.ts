/**
 * Photo listing, upload, and CRUD (Strapi).
 */

import type {StrapiCredentials} from "./client";
import {strapiRequest, unwrapDataArray, unwrapOne} from "./client";
import {
  fetchPhotoById,
  fetchPropertyIfOwned,
  propertyIdFromPhoto,
} from "./access";
import {mapPhotoToClient} from "./mappers";

/**
 * Uploads binary file to Strapi media library.
 * @param {StrapiCredentials} creds Strapi credentials.
 * @param {Buffer} fileBuffer Raw bytes.
 * @param {string} filename Original filename.
 * @param {string} mimeType MIME type.
 * @return {Promise<string>} Uploaded file documentId for `photo.file`.
 */
export async function uploadBinary(
  creds: StrapiCredentials,
  fileBuffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const boundary = `----FormBoundary${Date.now()}`;
  const escapedFilename = filename.replace(/"/g, "\\\"");
  const disp =
    "Content-Disposition: form-data; name=\"files\"; " +
    `filename="${escapedFilename}"`;
  const head =
    `--${boundary}\r\n` +
    `${disp}\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`;
  const tail = `\r\n--${boundary}--\r\n`;
  const body = Buffer.concat([
    Buffer.from(head, "utf8"),
    fileBuffer,
    Buffer.from(tail, "utf8"),
  ]);
  const res = await fetch(`${creds.baseUrl}/api/upload`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${creds.token}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`Strapi upload: ${res.status} ${text}`);
  }
  const parsed = JSON.parse(text) as
    | Array<{documentId?: string; id?: number}>
    | {data?: Array<{documentId?: string; id?: number}>};
  const arr = Array.isArray(parsed) ?
    parsed :
    (Array.isArray(parsed.data) ? parsed.data : []);
  const first = arr[0] ?? null;
  const idFromNumeric =
    first?.id != null ? String(first.id) : "";
  const idOut = first?.documentId ?? idFromNumeric;
  if (!idOut) {
    throw new Error("Strapi upload: missing file id");
  }
  return idOut;
}

/**
 * @param {StrapiCredentials} creds Strapi credentials.
 * @param {string} appProfileDocumentId Owner profile documentId.
 * @param {string} propertyDocumentId Property documentId.
 * @param {string|undefined} spaceDocumentId Optional space filter.
 * @param {string|undefined} statusFilter assigned | unassigned.
 * @return {Promise<Record<string, unknown>[]>} Client-shaped photos.
 */
export async function listPhotosForProperty(
  creds: StrapiCredentials,
  appProfileDocumentId: string,
  propertyDocumentId: string,
  spaceDocumentId?: string,
  statusFilter?: string
): Promise<Record<string, unknown>[]> {
  if (!(await fetchPropertyIfOwned(
    creds,
    appProfileDocumentId,
    propertyDocumentId
  ))) {
    throw new Error("NOT_FOUND");
  }
  const pEnc = encodeURIComponent(propertyDocumentId);
  let path =
    `/api/photos?filters[property][documentId][$eq]=${pEnc}` +
    "&pagination[pageSize]=500" +
    "&populate[file][fields][0]=documentId" +
    "&populate[space][fields][0]=documentId" +
    "&populate[property][fields][0]=documentId";
  if (spaceDocumentId) {
    path += `&filters[space][documentId][$eq]=${encodeURIComponent(
      spaceDocumentId
    )}`;
  }
  const resp = await strapiRequest(creds, path);
  let photos = unwrapDataArray(resp).map((d) => mapPhotoToClient(d));

  if (statusFilter === "assigned") {
    photos = photos.filter((p) => {
      const hasSpace = p.space && String(p.space).length > 0;
      return p.assignment_status === "confirmed" || hasSpace;
    });
  } else if (statusFilter === "unassigned") {
    photos = photos.filter((p) => {
      const hasSpace = p.space && String(p.space).length > 0;
      return p.assignment_status === "unassigned" && !hasSpace;
    });
  }
  return photos;
}

/**
 * @param {StrapiCredentials} creds Strapi credentials.
 * @param {string} appProfileDocumentId Owner profile documentId.
 * @param {Record<string, unknown>} input Photo create body.
 * @return {Promise<Record<string, unknown>>} Created photo (client shape).
 */
export async function createPhoto(
  creds: StrapiCredentials,
  appProfileDocumentId: string,
  input: {
    property?: string;
    space?: string;
    file?: string;
    captured_at?: string;
    exif_datetime_original?: string;
    assignment_status?: string;
    notes?: string;
  }
): Promise<Record<string, unknown>> {
  if (!input.property || !input.file || !input.captured_at) {
    throw new Error("VALIDATION");
  }
  if (!(await fetchPropertyIfOwned(
    creds,
    appProfileDocumentId,
    input.property
  ))) {
    throw new Error("NOT_FOUND");
  }
  if (input.space) {
    const sEq = encodeURIComponent(input.space);
    const pEq = encodeURIComponent(input.property);
    const spacePath =
      `/api/spaces?filters[documentId][$eq]=${sEq}` +
      `&filters[property][documentId][$eq]=${pEq}` +
      "&pagination[pageSize]=1";
    const ok = await strapiRequest(creds, spacePath);
    if (unwrapDataArray(ok).length === 0) {
      throw new Error("BAD_SPACE");
    }
  }
  const data: Record<string, unknown> = {
    property: {connect: [input.property]},
    file: {connect: [String(input.file)]},
    captured_at: input.captured_at,
    uploaded_at: new Date().toISOString(),
  };
  if (input.space) {
    data.space = {connect: [input.space]};
    data.assignment_status = input.assignment_status || "confirmed";
  } else if (input.assignment_status !== undefined) {
    data.assignment_status = input.assignment_status;
  }
  if (input.exif_datetime_original) {
    data.exif_datetime_original = input.exif_datetime_original;
  }
  if (input.notes) {
    data.notes = input.notes;
  }
  const resp = await strapiRequest(creds, "/api/photos", {
    method: "POST",
    body: JSON.stringify({data}),
  });
  const doc = unwrapOne(resp);
  if (!doc) {
    throw new Error("Strapi: create photo failed");
  }
  return mapPhotoToClient(doc);
}

/**
 * @param {StrapiCredentials} creds Strapi credentials.
 * @param {string} appProfileDocumentId Owner profile documentId.
 * @param {Record<string, unknown>} input Patch body including id.
 * @return {Promise<Record<string, unknown>>} Updated photo.
 */
export async function updatePhoto(
  creds: StrapiCredentials,
  appProfileDocumentId: string,
  input: {
    id?: string;
    property?: string;
    space?: string;
    file?: string;
    assignment_status?: string;
    notes?: string;
  }
): Promise<Record<string, unknown>> {
  if (!input.id) {
    throw new Error("VALIDATION");
  }
  const raw = await fetchPhotoById(creds, input.id);
  if (!raw) {
    throw new Error("NOT_FOUND");
  }
  const photo = raw as unknown as Record<string, unknown>;
  const propertyId = propertyIdFromPhoto(photo);
  if (
    !propertyId ||
    !(await fetchPropertyIfOwned(creds, appProfileDocumentId, propertyId))
  ) {
    throw new Error("NOT_FOUND");
  }
  const enc = encodeURIComponent(input.id);
  const data: Record<string, unknown> = {};
  if (input.assignment_status !== undefined) {
    data.assignment_status = input.assignment_status;
  }
  if (input.notes !== undefined) {
    data.notes = input.notes;
  }
  if (input.file !== undefined) {
    data.file = {connect: [String(input.file)]};
  }
  if (input.space !== undefined) {
    if (input.space) {
      const sEnc = encodeURIComponent(input.space);
      const pEnc = encodeURIComponent(propertyId);
      const chk = await strapiRequest(
        creds,
        `/api/spaces?filters[documentId][$eq]=${sEnc}` +
          `&filters[property][documentId][$eq]=${pEnc}&pagination[pageSize]=1`
      );
      if (unwrapDataArray(chk).length === 0) {
        throw new Error("BAD_SPACE");
      }
      data.space = {connect: [input.space]};
      if (input.assignment_status === undefined) {
        data.assignment_status = "confirmed";
      }
    } else {
      data.space = null;
      if (input.assignment_status === undefined) {
        data.assignment_status = "unassigned";
      }
    }
  }
  const resp = await strapiRequest(creds, `/api/photos/${enc}`, {
    method: "PATCH",
    body: JSON.stringify({data}),
  });
  const doc = unwrapOne(resp);
  if (!doc) {
    throw new Error("Strapi: update photo failed");
  }
  return mapPhotoToClient(doc);
}

/**
 * @param {StrapiCredentials} creds Strapi credentials.
 * @param {string} appProfileDocumentId Owner profile documentId.
 * @param {string} photoDocumentId Photo documentId.
 * @return {Promise<Record<string, unknown>|null>} Photo or null.
 */
export async function getPhotoForProfile(
  creds: StrapiCredentials,
  appProfileDocumentId: string,
  photoDocumentId: string
): Promise<Record<string, unknown> | null> {
  const raw = await fetchPhotoById(creds, photoDocumentId);
  if (!raw) {
    return null;
  }
  const photo = raw as Record<string, unknown>;
  const propertyId = propertyIdFromPhoto(photo);
  if (
    !propertyId ||
    !(await fetchPropertyIfOwned(creds, appProfileDocumentId, propertyId))
  ) {
    return null;
  }
  const enc = encodeURIComponent(photoDocumentId);
  const photoPop =
    `/api/photos/${enc}?populate[file][fields][0]=documentId` +
    "&populate[space][fields][0]=documentId" +
    "&populate[property][fields][0]=documentId";
  const full = await strapiRequest(creds, photoPop);
  const doc = unwrapOne(full);
  return doc ? mapPhotoToClient(doc) : mapPhotoToClient(photo as never);
}

/**
 * @param {StrapiCredentials} creds Strapi credentials.
 * @param {string} appProfileDocumentId Owner profile documentId.
 * @param {string} photoDocumentId Photo documentId.
 * @return {Promise<boolean>} True if deleted.
 */
export async function deletePhotoForProfile(
  creds: StrapiCredentials,
  appProfileDocumentId: string,
  photoDocumentId: string
): Promise<boolean> {
  const raw = await fetchPhotoById(creds, photoDocumentId);
  if (!raw) {
    return false;
  }
  const photo = raw as Record<string, unknown>;
  const propertyId = propertyIdFromPhoto(photo);
  if (
    !propertyId ||
    !(await fetchPropertyIfOwned(creds, appProfileDocumentId, propertyId))
  ) {
    return false;
  }
  const phEnc = encodeURIComponent(photoDocumentId);
  const assigns = await strapiRequest(
    creds,
    `/api/photo-assignments?filters[photo][documentId][$eq]=${phEnc}` +
      "&pagination[pageSize]=100"
  );
  for (const a of unwrapDataArray(assigns)) {
    await strapiRequest(
      creds,
      `/api/photo-assignments/${encodeURIComponent(a.documentId)}`,
      {method: "DELETE"}
    );
  }
  await strapiRequest(creds, `/api/photos/${phEnc}`, {method: "DELETE"});
  return true;
}
