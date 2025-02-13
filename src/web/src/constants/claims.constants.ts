/**
 * Claims Management Constants
 * Version: 1.0.0
 * Defines comprehensive constants and enums for claims management in the MGA OS web application
 */

/**
 * Enum defining all possible claim status values in the claims lifecycle
 */
export enum CLAIM_STATUS {
  NEW = 'NEW',
  UNDER_REVIEW = 'UNDER_REVIEW',
  PENDING_INFO = 'PENDING_INFO',
  APPROVED = 'APPROVED',
  IN_PAYMENT = 'IN_PAYMENT',
  PAID = 'PAID',
  DENIED = 'DENIED',
  CLOSED = 'CLOSED',
  REOPENED = 'REOPENED'
}

/**
 * Enum defining all supported claim document types
 */
export enum CLAIM_DOCUMENT_TYPES {
  FNOL = 'FNOL',
  POLICE_REPORT = 'POLICE_REPORT',
  PHOTOS = 'PHOTOS',
  ESTIMATE = 'ESTIMATE',
  INVOICE = 'INVOICE',
  MEDICAL_REPORT = 'MEDICAL_REPORT',
  WITNESS_STATEMENT = 'WITNESS_STATEMENT',
  OTHER = 'OTHER'
}

/**
 * Array of claim statuses that represent final states
 */
export const FINAL_CLAIM_STATUSES: CLAIM_STATUS[] = [
  CLAIM_STATUS.PAID,
  CLAIM_STATUS.DENIED,
  CLAIM_STATUS.CLOSED
];

/**
 * Array of claim statuses that represent active states requiring attention
 */
export const ACTIVE_CLAIM_STATUSES: CLAIM_STATUS[] = [
  CLAIM_STATUS.NEW,
  CLAIM_STATUS.UNDER_REVIEW,
  CLAIM_STATUS.PENDING_INFO,
  CLAIM_STATUS.APPROVED,
  CLAIM_STATUS.IN_PAYMENT,
  CLAIM_STATUS.REOPENED
];

/**
 * Human-readable labels for claim document types in the UI
 */
export const CLAIM_TYPE_LABELS: Record<CLAIM_DOCUMENT_TYPES, string> = {
  [CLAIM_DOCUMENT_TYPES.FNOL]: 'First Notice of Loss',
  [CLAIM_DOCUMENT_TYPES.POLICE_REPORT]: 'Police Report',
  [CLAIM_DOCUMENT_TYPES.PHOTOS]: 'Incident Photos',
  [CLAIM_DOCUMENT_TYPES.ESTIMATE]: 'Damage Estimate',
  [CLAIM_DOCUMENT_TYPES.INVOICE]: 'Repair Invoice',
  [CLAIM_DOCUMENT_TYPES.MEDICAL_REPORT]: 'Medical Report',
  [CLAIM_DOCUMENT_TYPES.WITNESS_STATEMENT]: 'Witness Statement',
  [CLAIM_DOCUMENT_TYPES.OTHER]: 'Other Document'
};

/**
 * Human-readable labels for claim statuses in the UI
 */
export const CLAIM_STATUS_LABELS: Record<CLAIM_STATUS, string> = {
  [CLAIM_STATUS.NEW]: 'New Claim',
  [CLAIM_STATUS.UNDER_REVIEW]: 'Under Review',
  [CLAIM_STATUS.PENDING_INFO]: 'Pending Information',
  [CLAIM_STATUS.APPROVED]: 'Approved',
  [CLAIM_STATUS.IN_PAYMENT]: 'In Payment',
  [CLAIM_STATUS.PAID]: 'Paid',
  [CLAIM_STATUS.DENIED]: 'Denied',
  [CLAIM_STATUS.CLOSED]: 'Closed',
  [CLAIM_STATUS.REOPENED]: 'Reopened'
};

/**
 * Maximum allowed length for claim descriptions
 */
export const MAX_CLAIM_DESCRIPTION_LENGTH = 2000;

/**
 * Maximum allowed file size for claim documents in megabytes
 */
export const MAX_FILE_SIZE_MB = 25;

/**
 * List of allowed file extensions for claim documents
 */
export const ALLOWED_FILE_TYPES = [
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.doc',
  '.docx'
];

/**
 * Defines allowed status transitions for claims workflow management
 * Maps current status to array of allowed next statuses
 */
export const CLAIM_STATUS_TRANSITIONS: Record<CLAIM_STATUS, CLAIM_STATUS[]> = {
  [CLAIM_STATUS.NEW]: [
    CLAIM_STATUS.UNDER_REVIEW,
    CLAIM_STATUS.DENIED
  ],
  [CLAIM_STATUS.UNDER_REVIEW]: [
    CLAIM_STATUS.PENDING_INFO,
    CLAIM_STATUS.APPROVED,
    CLAIM_STATUS.DENIED
  ],
  [CLAIM_STATUS.PENDING_INFO]: [
    CLAIM_STATUS.UNDER_REVIEW,
    CLAIM_STATUS.DENIED
  ],
  [CLAIM_STATUS.APPROVED]: [
    CLAIM_STATUS.IN_PAYMENT
  ],
  [CLAIM_STATUS.IN_PAYMENT]: [
    CLAIM_STATUS.PAID
  ],
  [CLAIM_STATUS.PAID]: [
    CLAIM_STATUS.CLOSED
  ],
  [CLAIM_STATUS.DENIED]: [
    CLAIM_STATUS.CLOSED
  ],
  [CLAIM_STATUS.CLOSED]: [
    CLAIM_STATUS.REOPENED
  ],
  [CLAIM_STATUS.REOPENED]: [
    CLAIM_STATUS.UNDER_REVIEW
  ]
};