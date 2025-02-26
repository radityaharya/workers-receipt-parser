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
    this.validateStoreInfo(receipt, issues);
    this.validateDuplicateItems(receipt, issues);
    this.validateTimeFormat(receipt, issues);
    this.validateSummaryCalculations(receipt, issues);
    this.validateNegativeAmounts(receipt, issues);
    this.validateCardNumbers(receipt, issues);
    this.validateDiscrepancy(receipt, issues);
    this.validateServiceCharge(receipt, issues);
    this.validateTotalAmount(receipt, issues);

    // Calculate confidence score with dynamic weighting based on issue type
    // Base weights
    const baseFatalWeight = 0.6;
    const baseErrorWeight = 0.3;
    const baseWarningWeight = 0.1;
    const baseInfoWeight = 0.03;

    let confidenceReduction = 0;

    issues.forEach((issue) => {
      let weight: number;


      switch (issue.severity) {
        case ValidationSeverity.FATAL:
          weight = baseFatalWeight;
          break;
        case ValidationSeverity.ERROR:
          weight = baseErrorWeight;
          break;
        case ValidationSeverity.WARNING:
          weight = baseWarningWeight;
          break;
        default:
          weight = baseInfoWeight;
      }

      // Apply dynamic weight adjustment for numerical discrepancy issues
      if (this.isNumericalDiscrepancyIssue(issue.type)) {
        const discrepancyPercentage = this.extractDiscrepancyPercentage(
          issue.message
        );
        if (discrepancyPercentage !== null) {
          // Scale down the weight for small discrepancies
          // A 1% discrepancy will reduce the weight by 90%
          // A 5% discrepancy will reduce the weight by 50%
          // A 10%+ discrepancy will use the full weight
          const adjustmentFactor = Math.min(1.0, discrepancyPercentage / 10);
          weight *= adjustmentFactor;
        }
      }

      confidenceReduction += weight;
    });

    // Base confidence score is 1.0 (100%)
    const confidenceScore = Math.max(0, 1.0 - confidenceReduction);

    return {
      valid:
        issues.filter((i) => i.severity === ValidationSeverity.ERROR).length ===
        0,
      issues,
      confidence_score: parseFloat(confidenceScore.toFixed(2)),
    };
  }

  /**
   * Determines if an issue type is related to numerical discrepancies
   */
  private static isNumericalDiscrepancyIssue(type: string): boolean {
    return [
      ValidationIssueTypes.ITEMS_SUBTOTAL_MISMATCH,
      ValidationIssueTypes.SUMMARY_CALCULATION_ERROR,
      ValidationIssueTypes.ITEM_PRICE_CALCULATION,
      ValidationIssueTypes.PAYMENT_METHODS_MISMATCH,
      ValidationIssueTypes.DISCREPANCY_EXPLANATION,
    ].includes(type as ValidationIssueTypes);
  }

  /**
   * Extracts the percentage discrepancy from issue messages
   * Returns null if unable to determine discrepancy percentage
   */
  private static extractDiscrepancyPercentage(message: string): number | null {
    try {
      // Extract numerical values from patterns like "162000.00" and "162199.00"
      const numbers = message.match(/(\d+\.\d+)/g);
      if (!numbers || numbers.length < 2) return null;

      // Get the two main numbers to compare
      const value1 = parseFloat(numbers[0]);
      const value2 = parseFloat(numbers[1]);

      // Use the larger one as the base for percentage calculation
      const base = Math.max(value1, value2);
      const diff = Math.abs(value1 - value2);

      if (base === 0) return null; // Avoid division by zero

      // Calculate percentage difference
      return (diff / base) * 100;
    } catch (e) {
      return null;
    }
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

  private static validateStoreInfo(
    receipt: ReceiptType,
    issues: ValidationIssue[]
  ): void {
    if (!receipt.header) return;

    if (!receipt.header.store_name || receipt.header.store_name.trim() === "") {
      issues.push({
        type: ValidationIssueTypes.EMPTY_STORE_NAME,
        message: "Store name is empty or missing",
        severity: ValidationSeverity.WARNING,
      });
    }

    if (
      !receipt.header.store_address ||
      receipt.header.store_address.trim() === ""
    ) {
      issues.push({
        type: ValidationIssueTypes.EMPTY_STORE_ADDRESS,
        message: "Store address is empty or missing",
        severity: ValidationSeverity.INFO,
      });
    }
  }

  private static validateDuplicateItems(
    receipt: ReceiptType,
    issues: ValidationIssue[]
  ): void {
    if (!receipt.items || receipt.items.length <= 1) return;

    // Check for items with identical descriptions and unit prices
    const itemSignatures = new Map<string, number[]>();

    receipt.items.forEach((item, index) => {
      if (!item.description) return;

      const signature = `${item.description.trim().toLowerCase()}_${
        item.unit_price
      }`;
      if (itemSignatures.has(signature)) {
        itemSignatures.get(signature)?.push(index);
      } else {
        itemSignatures.set(signature, [index]);
      }
    });

    for (const [signature, indexes] of itemSignatures.entries()) {
      if (indexes.length > 1) {
        const itemIndexes = indexes.map((i) => i + 1).join(", "); // 1-based indexing for readability
        issues.push({
          type: ValidationIssueTypes.DUPLICATE_ITEMS,
          message: `Potential duplicate items found (items ${itemIndexes})`,
          severity: ValidationSeverity.INFO,
        });
      }
    }
  }

  private static validateTimeFormat(
    receipt: ReceiptType,
    issues: ValidationIssue[]
  ): void {
    if (!receipt.header?.timestamp) return;

    // Check if the timestamp follows ISO 8601 / RFC3339 format
    const isoDatePattern =
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
    // e.g., 2023-10-05T14:48:00Z or 2023-10-05T14:48:00+07:00
    if (!isoDatePattern.test(receipt.header.timestamp)) {
      issues.push({
        type: ValidationIssueTypes.TIMESTAMP_FORMAT,
        message: "Timestamp format does not follow ISO 8601 / RFC3339 standard",
        severity: ValidationSeverity.WARNING,
      });
    }
  }

  private static validateSummaryCalculations(
    receipt: ReceiptType,
    issues: ValidationIssue[]
  ): void {
    if (
      !receipt.summary ||
      !receipt.summary.subtotal ||
      !receipt.summary.taxes ||
      !receipt.summary.total
    )
      return;

    const { subtotal, taxes, total, discounts, service_charge } =
      receipt.summary;
    let expectedTotal = subtotal + taxes;

    if (service_charge) {
      expectedTotal += service_charge;
    }

    if (discounts) {
      expectedTotal -= discounts;
    }

    // Allow for small rounding differences (0.01 units)
    if (Math.abs(expectedTotal - total) > 0.01) {
      issues.push({
        type: ValidationIssueTypes.SUMMARY_CALCULATION_ERROR,
        message: `Calculated total (${expectedTotal.toFixed(
          2
        )}) doesn't match stated total (${total.toFixed(2)})`,
        severity: ValidationSeverity.WARNING,
      });
    }
  }

  private static validateNegativeAmounts(
    receipt: ReceiptType,
    issues: ValidationIssue[]
  ): void {
    // Check for negative amounts in items
    if (receipt.items) {
      receipt.items.forEach((item, index) => {
        if (item.quantity < 0 || item.unit_price < 0 || item.total_price < 0) {
          issues.push({
            type: ValidationIssueTypes.NEGATIVE_AMOUNT,
            message: `Item ${index + 1} (${
              item.description
            }) has negative values`,
            severity: ValidationSeverity.WARNING,
          });
        }
      });
    }

    // Check for negative amounts in summary
    if (receipt.summary) {
      if (receipt.summary.subtotal < 0) {
        issues.push({
          type: ValidationIssueTypes.NEGATIVE_AMOUNT,
          message: "Subtotal is negative",
          severity: ValidationSeverity.WARNING,
        });
      }

      if (receipt.summary.total < 0) {
        issues.push({
          type: ValidationIssueTypes.NEGATIVE_AMOUNT,
          message: "Total amount is negative",
          severity: ValidationSeverity.WARNING,
        });
      }
    }
  }

  private static validateCardNumbers(
    receipt: ReceiptType,
    issues: ValidationIssue[]
  ): void {
    if (!receipt.payment?.payment_methods) return;

    const cardMethods = ["Credit Card", "Debit Card"];

    receipt.payment.payment_methods.forEach((method, index) => {
      if (cardMethods.includes(method.method)) {
        // Card payment should have a card number
        if (!method.card_four_digit) {
          issues.push({
            type: ValidationIssueTypes.CARD_NUMBER_FORMAT,
            message: `Payment method ${index + 1} (${
              method.method
            }) is missing card number`,
            severity: ValidationSeverity.INFO,
          });
        } else if (!/^\d{4}$/.test(method.card_four_digit)) {
          issues.push({
            type: ValidationIssueTypes.CARD_NUMBER_FORMAT,
            message: `Payment method ${
              index + 1
            } has invalid card number format (should be 4 digits)`,
            severity: ValidationSeverity.WARNING,
          });
        }
      }
    });
  }

  private static validateDiscrepancy(
    receipt: ReceiptType,
    issues: ValidationIssue[]
  ): void {
    if (!receipt.summary || !receipt.summary.discrepancy) return;

    // If there's a significant discrepancy (more than $1)
    if (Math.abs(receipt.summary.discrepancy) > 1) {
      issues.push({
        type: ValidationIssueTypes.DISCREPANCY_EXPLANATION,
        message: `Significant discrepancy (${receipt.summary.discrepancy.toFixed(
          2
        )}) detected in receipt totals`,
        severity: ValidationSeverity.WARNING,
      });
    }
  }

  private static validateServiceCharge(
    receipt: ReceiptType,
    issues: ValidationIssue[]
  ): void {
    if (!receipt.summary?.subtotal) return;

    // First, check if service charge exists and is within reasonable range
    if (receipt.summary.service_charge) {
      const serviceChargePercent =
        (receipt.summary.service_charge / receipt.summary.subtotal) * 100;

      if (serviceChargePercent > 25) {
        issues.push({
          type: ValidationIssueTypes.SERVICE_CHARGE_CALCULATION,
          message: `Service charge (${serviceChargePercent.toFixed(
            1
          )}%) seems unusually high`,
          severity: ValidationSeverity.INFO,
        });
      }

      // Check if taxes and service charge are identical (common error in parsing)
      if (
        receipt.summary.taxes &&
        Math.abs(receipt.summary.service_charge - receipt.summary.taxes) < 0.01
      ) {
        issues.push({
          type: ValidationIssueTypes.SERVICE_CHARGE_CALCULATION,
          message: `Service charge (${receipt.summary.service_charge.toFixed(
            2
          )}) is identical to tax amount, possibly a duplicate or parsing error`,
          severity: ValidationSeverity.INFO,
        });
      }
    }

    // Check for total calculation correctness including service charge
    if (receipt.summary.taxes && receipt.summary.total) {
      let expectedTotal = receipt.summary.subtotal + receipt.summary.taxes;
      
      // Only add service charge to expected total if it should be included
      const shouldIncludeServiceCharge = 
        receipt.summary.service_charge && 
        (receipt.summary.service_charge_included === true);
        
      if (shouldIncludeServiceCharge) {
        expectedTotal += receipt.summary.service_charge!;
      }

      if (receipt.summary.discounts) {
        expectedTotal -= receipt.summary.discounts;
      }

      if (Math.abs(expectedTotal - receipt.summary.total) > 0.01) {
        // If service charge exists but discrepancy equals service charge, add note about it
        if (
          receipt.summary.service_charge &&
          Math.abs(Math.abs(receipt.summary.discrepancy || 0) - receipt.summary.service_charge) < 0.01
        ) {
          issues.push({
            type: ValidationIssueTypes.SERVICE_CHARGE_CALCULATION,
            message: `Service charge (${receipt.summary.service_charge.toFixed(2)}) appears to be ${
              receipt.summary.service_charge_included ? "included in" : "excluded from"
            } the total amount`,
            severity: ValidationSeverity.INFO,
          });
        } else {
          issues.push({
            type: ValidationIssueTypes.SUMMARY_CALCULATION_ERROR,
            message: `Total calculation ${shouldIncludeServiceCharge ? "with" : "without"} service charge: expected ${expectedTotal.toFixed(
              2
            )}, got ${receipt.summary.total.toFixed(2)}`,
            severity: ValidationSeverity.WARNING,
          });
        }
      }
    }
  }

  // hacky validation for IDR receipts
  private static validateTotalAmount(
    receipt: ReceiptType,
    issues: ValidationIssue[]
  ): void {
    if (!receipt.summary?.total) return;

    const threshold = 1000;
    if (receipt.summary.total < threshold) {
      issues.push({
        type: ValidationIssueTypes.TOTAL_TOO_SMALL,
        message: `Total too less than ${threshold}, might be because of thousand scaling`,
        severity: ValidationSeverity.FATAL,
      });
    }
  }
}
