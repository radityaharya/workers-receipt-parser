import { z } from "zod";

export const ValidationIssueTypes = {
  // Date/time related
  TIMESTAMP_FUTURE: 'timestamp_future',
  TIMESTAMP_TOO_OLD: 'timestamp_too_old',
  TIMESTAMP_INVALID: 'timestamp_invalid',
  
  // Tax related
  UNUSUAL_TAX_RATE: 'unusual_tax_rate',
  
  // Total calculation related
  ITEMS_SUBTOTAL_MISMATCH: 'items_subtotal_mismatch',
  TOTAL_CALCULATION_ERROR: 'total_calculation_error',
  
  // Currency related
  INVALID_CURRENCY_CODE: 'invalid_currency_code',
  
  // Receipt number related
  SUSPICIOUS_RECEIPT_NUMBER: 'suspicious_receipt_number',
  
  // Item price related
  ITEM_PRICE_CALCULATION: 'item_price_calculation',
  
  // Payment related
  PAYMENT_METHODS_MISMATCH: 'payment_methods_mismatch',
} as const;

export type ValidationIssueType = typeof ValidationIssueTypes[keyof typeof ValidationIssueTypes];

export const ValidationSeverity = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
} as const;

export type ValidationSeverityType = typeof ValidationSeverity[keyof typeof ValidationSeverity];

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
  ValidationIssueTypes.PAYMENT_METHODS_MISMATCH
]);

export const validationSeveritySchema = z.enum([
  ValidationSeverity.ERROR,
  ValidationSeverity.WARNING,
  ValidationSeverity.INFO
]);

export const validationIssueSchema = z.object({
  type: validationIssueTypeSchema,
  message: z.string(),
  severity: validationSeveritySchema
});

export const validationResultSchema = z.object({
  valid: z.boolean(),
  issues: z.array(validationIssueSchema),
  confidence_score: z.number().min(0).max(1)
});


export type ValidationIssue = z.infer<typeof validationIssueSchema>;
export type ValidationResult = z.infer<typeof validationResultSchema>;