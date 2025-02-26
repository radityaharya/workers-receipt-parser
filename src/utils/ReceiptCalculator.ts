import { ReceiptType } from "../../schema/receipt.zod";

export class ReceiptCalculator {
  static calculateDiscrepancy(receipt: ReceiptType): ReceiptType {
    if (
      !receipt.items ||
      !receipt.summary ||
      typeof receipt.summary.total !== "number"
    ) {
      return receipt;
    }

    // Calculate the sum of all line item totals
    const calculatedTotal = receipt.items.reduce((sum: number, item) => {
      return (
        sum + (typeof item.total_price === "number" ? item.total_price : 0)
      );
    }, 0);

    // Get the tax and discount amounts from summary
    const taxAmount =
      typeof receipt.summary.taxes === "number" ? receipt.summary.taxes : 0;
    const discountAmount =
      typeof receipt.summary.discounts === "number"
        ? receipt.summary.discounts
        : 0;

    // Get service charge amount from summary
    const serviceChargeAmount =
      typeof receipt.summary.service_charge === "number"
        ? receipt.summary.service_charge
        : 0;

    // Calculate sum of other charges
    const otherChargesAmount =
      receipt.summary.other_charges?.reduce(
        (sum: number, charge) =>
          sum + (typeof charge.amount === "number" ? charge.amount : 0),
        0
      ) || 0;

    // Calculate expected total with and without service charge
    const expectedTotalWithServiceCharge =
      calculatedTotal +
      taxAmount +
      serviceChargeAmount +
      otherChargesAmount -
      discountAmount;
    
    const expectedTotalWithoutServiceCharge =
      calculatedTotal +
      taxAmount +
      otherChargesAmount -
      discountAmount;

    // Calculate discrepancies for both scenarios
    const discrepancyWithServiceCharge = Number(
      (receipt.summary.total - expectedTotalWithServiceCharge).toFixed(2)
    );
    
    const discrepancyWithoutServiceCharge = Number(
      (receipt.summary.total - expectedTotalWithoutServiceCharge).toFixed(2)
    );

    // Determine if service charge is included in total based on which discrepancy is smaller
    const isServiceChargeIncluded = 
      Math.abs(discrepancyWithServiceCharge) < Math.abs(discrepancyWithoutServiceCharge);
    
    // Use the appropriate discrepancy value
    const discrepancy = isServiceChargeIncluded 
      ? discrepancyWithServiceCharge 
      : discrepancyWithoutServiceCharge;

    // Add service_charge_included flag to help with validation
    const updatedReceipt = {
      ...receipt,
      summary: {
        ...receipt.summary,
        discrepancy: discrepancy,
        service_charge_included: isServiceChargeIncluded,
      },
    };

    return updatedReceipt;
  }
}
