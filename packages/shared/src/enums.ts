/**
 * Closed sets shared by the API and the web app.
 * Every value here is also a row in the database lookup tables; the string
 * codes are stable identifiers, the labels live in the i18n message files.
 */

export const ComplaintType = {
  CORRECTIVE: "CORRECTIVE",
  PREVENTIVE: "PREVENTIVE",
  OFI: "OFI",
} as const;
export type ComplaintType = (typeof ComplaintType)[keyof typeof ComplaintType];

export const Source = {
  INTERNAL_FEEDBACK: "INTERNAL_FEEDBACK",
  INTERNAL_AUDIT: "INTERNAL_AUDIT",
  EXTERNAL_AUDIT: "EXTERNAL_AUDIT",
  MANAGEMENT_REVIEW: "MANAGEMENT_REVIEW",
  SUPPLIER: "SUPPLIER",
  CUSTOMER: "CUSTOMER",
  OTHER: "OTHER",
} as const;
export type Source = (typeof Source)[keyof typeof Source];

export const Process = {
  PROD_HYPER: "PROD_HYPER",
  PROD_NORMAL: "PROD_NORMAL",
  POWDER_COATING: "POWDER_COATING",
  WAREHOUSE: "WAREHOUSE",
  PURCHASING: "PURCHASING",
  LOGISTIC: "LOGISTIC",
  QUALITY: "QUALITY",
  SALES_HYPER: "SALES_HYPER",
  SALES_NORMAL: "SALES_NORMAL",
  OTHER: "OTHER",
} as const;
export type Process = (typeof Process)[keyof typeof Process];

export const Priority = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  URGENT: "URGENT",
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

/** NCR lifecycle. Transitions are data in `state_transitions`; this is the vocabulary. */
export const NcrState = {
  SUBMITTED: "SUBMITTED",
  NEED_MORE_INFO: "NEED_MORE_INFO",
  REJECTED: "REJECTED",
  ASSIGNED: "ASSIGNED",
  IN_PROGRESS: "IN_PROGRESS",
  AWAITING_VERIFICATION: "AWAITING_VERIFICATION",
  RETURNED: "RETURNED",
  CLOSED: "CLOSED",
} as const;
export type NcrState = (typeof NcrState)[keyof typeof NcrState];

export const Role = {
  ISSUER: "ISSUER",
  PIC: "PIC",
  DEPT_MANAGER: "DEPT_MANAGER",
  QA_COORDINATOR: "QA_COORDINATOR",
  QA_MANAGER: "QA_MANAGER",
  AUDITOR: "AUDITOR",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const RejectionReason = {
  DUPLICATE: "DUPLICATE",
  NOT_NC: "NOT_NC",
  INSUFFICIENT_INFO: "INSUFFICIENT_INFO",
  OUT_OF_SCOPE: "OUT_OF_SCOPE",
  OTHER: "OTHER",
} as const;
export type RejectionReason = (typeof RejectionReason)[keyof typeof RejectionReason];

export const Disposition = {
  REPAIR_BY_SUPPLIER: "REPAIR_BY_SUPPLIER",
  RETURN_TO_SUPPLIER: "RETURN_TO_SUPPLIER",
  CREDIT_NOTE: "CREDIT_NOTE",
  REWORK_INTERNAL: "REWORK_INTERNAL",
  SPECIAL_ADAPTION: "SPECIAL_ADAPTION",
  DISPOSAL: "DISPOSAL",
  USE_AS_IS: "USE_AS_IS",
  OTHER: "OTHER",
} as const;
export type Disposition = (typeof Disposition)[keyof typeof Disposition];

export const VerificationResult = {
  SATISFACTORY: "SATISFACTORY",
  NON_SATISFACTORY: "NON_SATISFACTORY",
} as const;
export type VerificationResult = (typeof VerificationResult)[keyof typeof VerificationResult];

export const QuantityUnit = { PCS: "PCS", KG: "KG", M: "M", SET: "SET" } as const;
export type QuantityUnit = (typeof QuantityUnit)[keyof typeof QuantityUnit];

export const ClockKind = {
  TRIAGE: "TRIAGE",
  RESPONSE: "RESPONSE",
  RESOLUTION: "RESOLUTION",
  VERIFICATION: "VERIFICATION",
} as const;
export type ClockKind = (typeof ClockKind)[keyof typeof ClockKind];
