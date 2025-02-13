/**
 * Common TypeScript types, interfaces and utility types used across the MGA Operating System web frontend.
 * @version 1.0.0
 */

/**
 * Type alias for entity IDs used across the application
 */
export type ID = string;

/**
 * Type alias for ISO timestamp strings
 */
export type Timestamp = string;

/**
 * Interface for date range selections in filters and reports
 */
export interface DateRange {
  startDate: Timestamp;
  endDate: Timestamp;
}

/**
 * Interface for pagination parameters used in list views
 */
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

/**
 * Generic interface for API responses
 * @template T - The type of data returned in the response
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: ErrorResponse | null;
}

/**
 * Interface for standardized error responses
 */
export interface ErrorResponse {
  code: string;
  message: string;
  details: Record<string, any>;
}

/**
 * Type for component loading states
 */
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Interface for form validation results
 */
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string[]>;
}

/**
 * Interface for dropdown/select options
 */
export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

/**
 * Utility type to make all properties in T optional
 */
export type Partial<T> = {
  [P in keyof T]?: T[P];
};

/**
 * Utility type to make all properties in T required
 */
export type Required<T> = {
  [P in keyof T]-?: T[P];
};

/**
 * Utility type to make all properties in T readonly
 */
export type Readonly<T> = {
  readonly [P in keyof T]: T[P];
};

/**
 * Utility type to pick specific properties K from type T
 */
export type Pick<T, K extends keyof T> = {
  [P in K]: T[P];
};

/**
 * Utility type to omit specific properties K from type T
 */
export type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>;

/**
 * Utility type for record objects with string keys and specified value type
 */
export type Dictionary<T> = Record<string, T>;

/**
 * Utility type for nullable values
 */
export type Nullable<T> = T | null;

/**
 * Utility type for optional values
 */
export type Optional<T> = T | undefined;

/**
 * Utility type for async operation status
 */
export interface AsyncOperationStatus {
  loading: boolean;
  error: ErrorResponse | null;
}