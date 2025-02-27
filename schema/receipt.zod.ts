import { z } from "zod";

export const receiptSchema = z.object({
  is_receipt: z
    .boolean()
    .optional()
    .describe("Indicates if the document is a receipt"),
  header: z.object({
    receipt_number: z.string(),
    timestamp: z
      .string()
      .describe("Receipt timestamp (RFC3339), Asia/Jakarta timezone"),
    store_name: z.string(),
    store_address: z.string(),
  }),
  category: z.enum([
    "Groceries",
    "Dining",
    "Transportation",
    "Entertainment",
    "Utilities",
    "Shopping",
    "Healthcare",
    "Travel",
    "Other",
  ]),
  items: z.array(
    z.object({
      description: z.string(),
      quantity: z.number(),
      unit_price: z
        .number()
        .describe(
          "Amount paid using this method (if less than 1000, assume its in thousands)"
        ),
      total_price: z
        .number()
        .describe(
          "Amount paid using this method (if less than 1000, assume its in thousands)"
        ),
      tax: z.number().optional(),
    })
  ),
  payment: z.object({
    total_amount: z.number(),
    currency: z
      .string()
      .default("IDR")
      .describe("Currency code, defaults to IDR"),
    payment_methods: z.array(
      z.object({
        method: z.enum([
          "Cash",
          "Credit Card",
          "Debit Card",
          "Digital Wallet",
          "Other",
        ]),
        amount: z
          .number()
          .describe(
            "Amount paid using this method (if less than 1000, assume its in thousands)"
          ),
        card_four_digit: z
          .string()
          .optional()
          .describe(
            "Last or first four digits of the card number (if applicable)"
          ),
      })
    ),
    taxes: z.number().optional(),
    discounts: z.number().optional(),
  }),
  summary: z.object({
    title: z
      .string()
      .describe("1-3 words that describes overall of the receipt (e.g. 'Coffee', 'McDonalds', etc)"),
    description: z
      .string()
      .describe(
        "A short description of the receipt, includes 'title' and 'place'"
      ),
    subtotal: z.number(),
    taxes: z.number(),
    total: z.number(),
    discounts: z.number().optional(),
    service_charge: z
      .number()
      .optional()
      .describe(
        "Service charge amount. (Usually indicated by 'SC' or 'Service Charge' or 'Service')"
      )
      .describe(
        "Amount paid using this method (if less than 1000, assume its in thousands)"
      ),
    other_charges: z
      .array(
        z.object({
          description: z.string(),
          amount: z
            .number()
            .describe(
              "Amount paid using this method (if less than 1000, assume its in thousands)"
            ),
        })
      )
      .optional(),
    discrepancy: z
      .number()
      .optional()
      .describe(
        "Difference between stated total and expected total (line items + tax - discount)"
      ),
    service_charge_included: z
      .boolean()
      .optional()
      .describe(
        "Indicates if service charge appears to be included in the total amount"
      ),
  }),
  notes: z.string().optional(),
  schema_version: z.string().optional(),
});

export type ReceiptType = z.infer<typeof receiptSchema>;
