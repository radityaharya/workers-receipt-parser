import { ReceiptType } from "../../schema/receipt.zod";
import {
  ValidationIssueTypes,
  ValidationSeverity,
  type ValidationResult,
  type ValidationIssue,
} from "./ValidationTypes";

export class ReceiptValidator {
  static validate(receipt: ReceiptType): ValidationResult {
    const issues: ValidationIssue[] = [];

    // Run all validations
    this.validateTimestamp(receipt, issues);
    this.validateTaxCalculations(receipt, issues);
    this.validateTotals(receipt, issues);
    this.validateCurrencyConsistency(receipt, issues);
    this.validateReceiptNumberFormat(receipt, issues);
    this.validateItemsQuantityPrice(receipt, issues);
    this.validatePaymentMethodsTotal(receipt, issues);

    // Calculate confidence score based on issues
    // More severe issues reduce confidence more
    const errorWeight = 0.3;
    const warningWeight = 0.1;
    const infoWeight = 0.03;

    const errorCount = issues.filter((i) => i.severity === "error").length;
    const warningCount = issues.filter((i) => i.severity === "warning").length;
    const infoCount = issues.filter((i) => i.severity === "info").length;

    // Base confidence score is 1.0 (100%)
    const confidenceScore = Math.max(
      0,
      1.0 -
        (errorCount * errorWeight +
          warningCount * warningWeight +
          infoCount * infoWeight)
    );

    return {
      valid: errorCount === 0,
      issues,
      confidence_score: parseFloat(confidenceScore.toFixed(2)),
    };
  }

  private static validateTimestamp(
    receipt: ReceiptType,
    issues: ValidationIssue[]
  ): void {
    if (!receipt.header?.timestamp) return;

    try {
      const timestamp = new Date(receipt.header.timestamp);
      const now = new Date();

      // Check if date is in the future
      if (timestamp > now) {
        issues.push({
          type: ValidationIssueTypes.TIMESTAMP_FUTURE,
          message: "Receipt timestamp is in the future",
          severity: ValidationSeverity.WARNING,
        });
      }

      // Check if date is too old (more than 10 years)
      const tenYearsAgo = new Date();
      tenYearsAgo.setFullYear(now.getFullYear() - 10);
      if (timestamp < tenYearsAgo) {
        issues.push({
          type: ValidationIssueTypes.TIMESTAMP_TOO_OLD,
          message: "Receipt timestamp is unusually old (>10 years)",
          severity: ValidationSeverity.WARNING,
        });
      }
    } catch (error) {
      issues.push({
        type: ValidationIssueTypes.TIMESTAMP_INVALID,
        message: "Receipt timestamp is invalid",
        severity: ValidationSeverity.ERROR,
      });
    }
  }

  private static validateTaxCalculations(
    receipt: ReceiptType,
    issues: ValidationIssue[]
  ): void {
    if (!receipt.summary?.taxes || !receipt.summary?.subtotal) return;

    // Common tax rates for quick validation (percentages)
    const commonTaxRates = [0, 5, 7, 10, 11, 12, 15, 18, 20, 21, 22, 25];

    const calculatedTaxRate =
      (receipt.summary.taxes / receipt.summary.subtotal) * 100;
    const roundedTaxRate = Math.round(calculatedTaxRate);

    // Check if the calculated tax rate is close to a common rate
    const isCommonRate = commonTaxRates.some(
      (rate) => Math.abs(roundedTaxRate - rate) <= 1
    );

    if (!isCommonRate && calculatedTaxRate > 0) {
      issues.push({
        type: ValidationIssueTypes.UNUSUAL_TAX_RATE,
        message: `Unusual tax rate detected: ${roundedTaxRate}%`,
        severity: ValidationSeverity.INFO,
      });
    }
  }

  private static validateTotals(
    receipt: ReceiptType,
    issues: ValidationIssue[]
  ): void {
    if (!receipt.summary?.total || !receipt.items) return;

    // If items total price doesn't match subtotal (allowing for small rounding differences)
    const itemsTotal = receipt.items.reduce(
      (sum, item) => sum + (item.total_price || 0),
      0
    );

    if (
      receipt.summary.subtotal &&
      Math.abs(itemsTotal - receipt.summary.subtotal) > 1
    ) {
      issues.push({
        type: ValidationIssueTypes.ITEMS_SUBTOTAL_MISMATCH,
        message: `Sum of item prices (${itemsTotal.toFixed(
          2
        )}) doesn't match subtotal (${receipt.summary.subtotal.toFixed(2)})`,
        severity: ValidationSeverity.WARNING,
      });
    }
  }

  private static validateCurrencyConsistency(
    receipt: ReceiptType,
    issues: ValidationIssue[]
  ): void {
    if (!receipt.payment?.currency) return;

    // Check if currency code is valid (simple check for 3 uppercase letters)
    if (!/^[A-Z]{3}$/.test(receipt.payment.currency)) {
      issues.push({
        type: ValidationIssueTypes.INVALID_CURRENCY_CODE,
        message: `Invalid currency code format: ${receipt.payment.currency}`,
        severity: ValidationSeverity.WARNING,
      });
    }
  }

  private static validateReceiptNumberFormat(
    receipt: ReceiptType,
    issues: ValidationIssue[]
  ): void {
    if (!receipt.header?.receipt_number) return;

    // Check if receipt number contains only valid characters
    if (!/^[A-Za-z0-9\-\/\.]+$/.test(receipt.header.receipt_number)) {
      issues.push({
        type: ValidationIssueTypes.SUSPICIOUS_RECEIPT_NUMBER,
        message: "Receipt number contains unusual characters",
        severity: ValidationSeverity.INFO,
      });
    }
  }

  private static validateItemsQuantityPrice(
    receipt: ReceiptType,
    issues: ValidationIssue[]
  ): void {
    if (!receipt.items || receipt.items.length === 0) return;

    receipt.items.forEach((item, index) => {
      if (item.quantity && item.unit_price && item.total_price) {
        const calculatedTotal = item.quantity * item.unit_price;
        // Allow for small rounding differences (0.01 units)
        if (Math.abs(calculatedTotal - item.total_price) > 0.01) {
          issues.push({
            type: ValidationIssueTypes.ITEM_PRICE_CALCULATION,
            message: `Item ${index + 1} (${
              item.description
            }): quantity × unit price (${calculatedTotal.toFixed(
              2
            )}) doesn't match total price (${item.total_price.toFixed(2)})`,
            severity: ValidationSeverity.WARNING,
          });
        }
      }
    });
  }

  private static validatePaymentMethodsTotal(
    receipt: ReceiptType,
    issues: ValidationIssue[]
  ): void {
    if (!receipt.payment?.payment_methods || !receipt.payment?.total_amount)
      return;

    const paymentMethodsTotal = receipt.payment.payment_methods.reduce(
      (sum, method) => sum + (method.amount || 0),
      0
    );

    // Check if payment methods total equals the total amount
    if (Math.abs(paymentMethodsTotal - receipt.payment.total_amount) > 0.01) {
      issues.push({
        type: ValidationIssueTypes.PAYMENT_METHODS_MISMATCH,
        message: `Sum of payment methods (${paymentMethodsTotal.toFixed(
          2
        )}) doesn't match total amount (${receipt.payment.total_amount.toFixed(
          2
        )})`,
        severity: ValidationSeverity.WARNING,
      });
    }
  }
}
