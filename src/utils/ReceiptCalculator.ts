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

    // Calculate expected total including service charge and other charges
    const expectedTotal =
      calculatedTotal +
      taxAmount +
      serviceChargeAmount +
      otherChargesAmount -
      discountAmount;

    // Calculate the discrepancy (stated total - expected total)
    const updatedReceipt = {
      ...receipt,
      summary: {
        ...receipt.summary,
        discrepancy: Number((receipt.summary.total - expectedTotal).toFixed(2)),
      },
    };

    return updatedReceipt;
  }
}
