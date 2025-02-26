import { z } from "zod";

export enum ValidationIssueTypes {
  // Existing types
  TIMESTAMP_FUTURE = "timestamp_future",
  TIMESTAMP_TOO_OLD = "timestamp_too_old",
  TIMESTAMP_INVALID = "timestamp_invalid",
  UNUSUAL_TAX_RATE = "unusual_tax_rate",
  ITEMS_SUBTOTAL_MISMATCH = "items_subtotal_mismatch",
  TOTAL_CALCULATION_ERROR = "total_calculation_error",
  INVALID_CURRENCY_CODE = "invalid_currency_code",
  SUSPICIOUS_RECEIPT_NUMBER = "suspicious_receipt_number",
  ITEM_PRICE_CALCULATION = "item_price_calculation",
  PAYMENT_METHODS_MISMATCH = "payment_methods_mismatch",

  // New types
  EMPTY_STORE_NAME = "empty_store_name",
  EMPTY_STORE_ADDRESS = "empty_store_address",
  DUPLICATE_ITEMS = "duplicate_items",
  TIMESTAMP_FORMAT = "timestamp_format",
  SUMMARY_CALCULATION_ERROR = "summary_calculation_error",
  NEGATIVE_AMOUNT = "negative_amount",
  SUSPICIOUS_CATEGORY = "suspicious_category",
  CARD_NUMBER_FORMAT = "card_number_format",
  DISCREPANCY_EXPLANATION = "discrepancy_explanation",
  SERVICE_CHARGE_CALCULATION = "service_charge_calculation",
  TOTAL_TOO_SMALL = "total_too_small",
}

export type ValidationIssueType =
  (typeof ValidationIssueTypes)[keyof typeof ValidationIssueTypes];

export const ValidationSeverity = {
  ERROR: "error",
  WARNING: "warning",
  INFO: "info",
  FATAL: "fatal",
} as const;

export type ValidationSeverityType =
  (typeof ValidationSeverity)[keyof typeof ValidationSeverity];

export const validationIssueTypeSchema = z.enum([
  ValidationIssueTypes.TIMESTAMP_FUTURE,
  ValidationIssueTypes.TIMESTAMP_TOO_OLD,
  ValidationIssueTypes.TIMESTAMP_INVALID,
  ValidationIssueTypes.UNUSUAL_TAX_RATE,
  ValidationIssueTypes.ITEMS_SUBTOTAL_MISMATCH,
  ValidationIssueTypes.TOTAL_CALCULATION_ERROR,
  ValidationIssueTypes.INVALID_CURRENCY_CODE,
  ValidationIssueTypes.SUSPICIOUS_RECEIPT_NUMBER,
  ValidationIssueTypes.ITEM_PRICE_CALCULATION,
  ValidationIssueTypes.PAYMENT_METHODS_MISMATCH,
  ValidationIssueTypes.EMPTY_STORE_NAME,
  ValidationIssueTypes.EMPTY_STORE_ADDRESS,
  ValidationIssueTypes.DUPLICATE_ITEMS,
  ValidationIssueTypes.TIMESTAMP_FORMAT,
  ValidationIssueTypes.SUMMARY_CALCULATION_ERROR,
  ValidationIssueTypes.NEGATIVE_AMOUNT,
  ValidationIssueTypes.SUSPICIOUS_CATEGORY,
  ValidationIssueTypes.CARD_NUMBER_FORMAT,
  ValidationIssueTypes.DISCREPANCY_EXPLANATION,
  ValidationIssueTypes.SERVICE_CHARGE_CALCULATION,
  ValidationIssueTypes.TOTAL_TOO_SMALL,
]);

export const validationSeveritySchema = z.enum([
  ValidationSeverity.ERROR,
  ValidationSeverity.WARNING,
  ValidationSeverity.INFO,
  ValidationSeverity.FATAL,
]);

export const validationIssueSchema = z.object({
  type: validationIssueTypeSchema,
  message: z.string(),
  severity: validationSeveritySchema,
});

export const validationResultSchema = z.object({
  valid: z.boolean(),
  issues: z.array(validationIssueSchema),
  confidence_score: z.number().min(0).max(1),
});

export type ValidationIssue = z.infer<typeof validationIssueSchema>;
export type ValidationResult = z.infer<typeof validationResultSchema>;
