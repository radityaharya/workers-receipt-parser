import { z } from "zod";
import { jsonSchemaToZod } from "@n8n/json-schema-to-zod";
import { receiptSchema } from "../../schema/receipt.v1";

const receiptZodSchema = jsonSchemaToZod(receiptSchema);
type ReceiptType = z.infer<typeof receiptZodSchema>;

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

    const expectedTotal = calculatedTotal + taxAmount - discountAmount;

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
