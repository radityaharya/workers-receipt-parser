export const receiptSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "Universal Receipt Schema",
  type: "object",
  properties: {
    is_receipt: {
      type: "boolean",
      description: "Indicates if the document is a receipt",
    },
    header: {
      type: "object",
      properties: {
        receipt_number: { type: "string" },
        timestamp: {
          type: "string",
          format: "date-time",
          description: "Receipt timestamp (RFC3339)",
        },
        store_name: { type: "string" },
        store_address: { type: "string" },
      },
      required: ["receipt_number", "timestamp", "store_name", "store_address"],
    },
    category: {
      type: "string",
      enum: [
        "Groceries",
        "Dining",
        "Transportation",
        "Entertainment",
        "Utilities",
        "Shopping",
        "Healthcare",
        "Travel",
        "Other",
      ],
    },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          quantity: { type: "number" },
          unit_price: { type: "number" },
          total_price: { type: "number" },
          tax: { type: "number" },
        },
        required: ["description", "quantity", "unit_price", "total_price"],
      },
    },
    payment: {
      type: "object",
      properties: {
        total_amount: { type: "number" },
        currency: {
          type: "string",
          default: "IDR",
          description: "Currency code, defaults to IDR",
        },
        payment_methods: {
          type: "array",
          items: {
            type: "object",
            properties: {
              method: {
                type: "string",
                enum: [
                  "Cash",
                  "Credit Card",
                  "Debit Card",
                  "Digital Wallet",
                  "Other",
                ],
              },
              amount: { type: "number" },
              card_four_digit: {
                type: "string",
                description:
                  "Last or first four digits of the card number (if applicable)",
              },
            },
            required: ["method", "amount"],
          },
        },
        taxes: { type: "number" },
        discounts: { type: "number" },
      },
      required: ["total_amount", "payment_methods"],
    },
    summary: {
      type: "object",
      properties: {
        subtotal: { type: "number" },
        taxes: { type: "number" },
        total: { type: "number" },
        discounts: { type: "number" },
        service_charge: { type: "number" },
        other_charges: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              amount: { type: "number" },
            },
            required: ["description", "amount"],
          },
        },
        discrepancy: {
          type: "number",
          description:
            "Difference between stated total and expected total (line items + tax - discount)",
        },
      },
      required: ["subtotal", "taxes", "total"],
    },
    notes: { type: "string" },
    schema_version: { type: "string" },
  },
  required: ["header", "category", "items", "payment", "summary"],
};
