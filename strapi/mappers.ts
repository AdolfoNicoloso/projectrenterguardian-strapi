/**
 * Maps Strapi documents to the JSON shapes the Expo app expects
 * (previously returned from Directus via Firebase Functions).
 */

import type {StrapiDocument} from "./client";

/**
 * @param {unknown} value Raw Strapi date/datetime.
 * @return {string|undefined} YYYY-MM-DD prefix or undefined.
 */
export function toDateOnlyString(value: unknown): string | undefined {
  if (value == null) {
    return undefined;
  }
  if (typeof value === "string") {
    return value.length >= 10 ? value.slice(0, 10) : value;
  }
  return String(value);
}

/**
 * @param {unknown} value Raw datetime.
 * @return {string|undefined} ISO string or undefined.
 */
export function toIsoString(value: unknown): string | undefined {
  if (value == null) {
    return undefined;
  }
  if (typeof value === "string") {
    return value;
  }
  return String(value);
}

/**
 * Reads relation as Directus-style string id (Strapi documentId).
 * @param {unknown} rel String id or populated { documentId }.
 * @return {string|undefined} Related documentId or undefined.
 */
export function relationDocumentId(rel: unknown): string | undefined {
  if (rel == null) {
    return undefined;
  }
  if (typeof rel === "string") {
    return rel;
  }
  if (typeof rel === "object" && rel !== null && "documentId" in rel) {
    return String((rel as {documentId: string}).documentId);
  }
  return undefined;
}

/**
 * @param {StrapiDocument} doc Strapi property row.
 * @param {string} appProfileDocumentId Owner profile documentId.
 * @return {Record<string, unknown>} Client property object.
 */
export function mapPropertyToClient(
  doc: StrapiDocument,
  appProfileDocumentId: string
): Record<string, unknown> {
  return {
    id: doc.documentId,
    app_profile_id: appProfileDocumentId,
    address_free_text: doc.address_free_text ?? "",
    lease_start_date: toDateOnlyString(doc.lease_start_date) ?? "",
    lease_end_date: toDateOnlyString(doc.lease_end_date),
    lease_term: doc.lease_term ?? undefined,
    nickname: doc.nickname ?? undefined,
    state_code: doc.state_code ?? undefined,
    status: doc.status ?? "active",
    street: doc.street ?? undefined,
    unit: doc.unit ?? undefined,
    city: doc.city ?? undefined,
    zip: doc.zip ?? undefined,
    date_created: doc.createdAt ?? undefined,
    date_updated: doc.updatedAt ?? undefined,
  };
}

/**
 * @param {StrapiDocument} doc Strapi space row.
 * @return {Record<string, unknown>} Client space object.
 */
export function mapSpaceToClient(doc: StrapiDocument): Record<string, unknown> {
  const propId = relationDocumentId(doc.property);
  return {
    id: doc.documentId,
    property: propId ?? "",
    space_type: doc.space_type ?? "",
    display_name: doc.display_name ?? "",
    custom_space_type: doc.custom_space_type ?? undefined,
    ordinal: doc.ordinal ?? undefined,
    is_default: doc.is_default ?? undefined,
    date_created: doc.createdAt ?? undefined,
    date_updated: doc.updatedAt ?? undefined,
  };
}

/**
 * @param {StrapiDocument} doc Strapi photo with optional populated relations.
 * @return {Record<string, unknown>} Client photo object.
 */
export function mapPhotoToClient(doc: StrapiDocument): Record<string, unknown> {
  const fileId = relationDocumentId(doc.file);
  const spaceId = relationDocumentId(doc.space);
  const propId = relationDocumentId(doc.property);
  return {
    id: doc.documentId,
    property: propId ?? "",
    space: spaceId ?? "",
    file: fileId ?? "",
    captured_at: toIsoString(doc.captured_at) ?? "",
    exif_datetime_original: toIsoString(doc.exif_datetime_original),
    assignment_status: doc.assignment_status ?? "unassigned",
    notes: doc.notes ?? undefined,
    date_created: doc.createdAt ?? undefined,
    date_updated: doc.updatedAt ?? undefined,
  };
}

/**
 * @param {StrapiDocument} doc Strapi report row.
 * @return {Record<string, unknown>} Client report object.
 */
export function mapReportToClient(
  doc: StrapiDocument
): Record<string, unknown> {
  const propId = relationDocumentId(doc.property);
  const pdfId = relationDocumentId(doc.pdf_file);
  return {
    id: doc.documentId,
    property: propId ?? "",
    snapshot_json: doc.snapshot_json ?? undefined,
    status: doc.status ?? "draft",
    pdf_file: pdfId ?? undefined,
    report_type: doc.report_type ?? undefined,
    context_state_code: doc.context_state_code ?? undefined,
    disclaimer_version: doc.disclaimer_version ?? undefined,
    generated_at: toIsoString(doc.generated_at) ?? doc.createdAt,
    date_created: doc.createdAt ?? undefined,
    date_updated: doc.updatedAt ?? undefined,
  };
}

/**
 * @param {StrapiDocument} doc Strapi inspection.
 * @return {Record<string, unknown>} Client inspection object.
 */
export function mapInspectionToClient(
  doc: StrapiDocument
): Record<string, unknown> {
  const propId = relationDocumentId(doc.property);
  return {
    id: doc.documentId,
    property_id: propId ?? "",
    created_by_user_id: doc.created_by_user_id ?? "",
    inspection_status: doc.inspection_status ?? "in_progress",
    inspection_type: doc.inspection_type ?? "",
    started_at: toIsoString(doc.started_at) ?? "",
    completed_at: toIsoString(doc.completed_at),
    last_step: doc.last_step ?? null,
    inspections_progress: doc.inspections_progress ?? 0,
    date_created: doc.createdAt ?? undefined,
    date_updated: doc.updatedAt ?? undefined,
  };
}

/**
 * @param {StrapiDocument} doc Strapi inspection step.
 * @return {Record<string, unknown>} Client inspection step object.
 */
export function mapInspectionStepToClient(
  doc: StrapiDocument
): Record<string, unknown> {
  const inspId = relationDocumentId(doc.inspection);
  return {
    id: doc.documentId,
    inspection_id: inspId ?? "",
    step_key: doc.step_key ?? "",
    inspection_step_status: doc.inspection_step_status ?? "not_started",
    payload_json: doc.payload_json ?? undefined,
    date_created: doc.createdAt ?? undefined,
    date_updated: doc.updatedAt ?? undefined,
  };
}

/**
 * @param {StrapiDocument} doc Strapi photo-assignment.
 * @return {Record<string, unknown>} Client assignment object.
 */
export function mapAssignmentToClient(
  doc: StrapiDocument
): Record<string, unknown> {
  const photoId = relationDocumentId(doc.photo);
  const spaceId = relationDocumentId(doc.space);
  return {
    id: doc.documentId,
    photo: photoId ?? "",
    space: spaceId ?? "",
    status: doc.status ?? "confirmed",
    confirmed_at: toIsoString(doc.confirmed_at),
    confirmed_by_app_profile: doc.confirmed_by_app_profile ?? undefined,
    method: doc.method ?? "manual",
    date_created: doc.createdAt ?? undefined,
    date_updated: doc.updatedAt ?? undefined,
  };
}

/**
 * @param {StrapiDocument} doc Strapi app-profile.
 * @return {Record<string, unknown>} Client app profile object.
 */
export function mapAppProfileToClient(
  doc: StrapiDocument
): Record<string, unknown> {
  return {
    id: doc.documentId,
    directus_users_id: doc.documentId,
    name: doc.name ?? undefined,
    onboarding_completed: doc.onboarding_completed ?? false,
    date_created: doc.createdAt ?? undefined,
    date_updated: doc.updatedAt ?? undefined,
  };
}

/**
 * @param {StrapiDocument} doc Strapi user-preference.
 * @return {Record<string, unknown>} Client preferences object.
 */
export function mapUserPreferenceToClient(
  doc: StrapiDocument
): Record<string, unknown> {
  const profileId = relationDocumentId(doc.app_profile);
  return {
    id: doc.documentId,
    app_profile_id: profileId ?? "",
    theme_preference: doc.theme_preference ?? "auto",
    preferred_language: doc.preferred_language ?? undefined,
    date_created: doc.createdAt ?? undefined,
    date_updated: doc.updatedAt ?? undefined,
  };
}
