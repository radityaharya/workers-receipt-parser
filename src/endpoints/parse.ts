import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { receiptSchema } from "../../schema/receipt.zod";
import { GeminiService } from "../services/GeminiService";
import { ReceiptCalculator } from "../utils/ReceiptCalculator";
import { ReceiptValidator } from "../utils/ReceiptValidator";
import { validationResultSchema } from "../utils/ValidationTypes";

const enhancedResponseSchema = receiptSchema.extend({
  validation: validationResultSchema
    .optional()
    .describe("Validation results with issues and confidence score"),
});

export class Parse extends OpenAPIRoute {
  schema = {
    tags: ["Parse"],
    summary: "Parse a receipt from base64 image",
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              image: z.string().describe("Base64 encoded image data"),
              model: z
                .string()
                .optional()
                .describe("Model ID to use for parsing (optional)"),
              validate: z
                .boolean()
                .optional()
                .default(true)
                .describe("Run validation on parsed receipt"),
            }),
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Returns parsed receipt data",
        content: {
          "application/json": {
            schema: enhancedResponseSchema,
          },
        },
      },
      "400": {
        description: "Invalid image data",
        content: {
          "application/json": {
            schema: z.object({
              error: z.string(),
            }),
          },
        },
      },
      "401": {
        description: "Unauthorized - Missing or invalid API key",
        content: {
          "application/json": {
            schema: z.object({
              error: z.string(),
            }),
          },
        },
      },
    },
  };

  async handle(c: any) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { image, model, validate = true } = data.body;

    try {
      if (!image || !/^data:image\/\w+;base64,/.test(image)) {
        return c.json({ error: "Invalid image data" }, 400);
      }

      const geminiService = new GeminiService(c.env.GEMINI_API_KEY, model);
      const result = await geminiService.parseReceipt(image);

      // Calculate discrepancy
      const receiptWithDiscrepancy =
        ReceiptCalculator.calculateDiscrepancy(result);

      // Run validation if requested
      if (validate) {
        const validationResult = ReceiptValidator.validate(
          receiptWithDiscrepancy
        );
        const enhancedResult = {
          ...receiptWithDiscrepancy,
          validation: validationResult,
        };
        return c.json(enhancedResult);
      }

      // Return without validation
      const validatedResult = enhancedResponseSchema.parse(
        receiptWithDiscrepancy
      );
      return c.json(validatedResult);
    } catch (error) {
      return c.json({ error: error.message || "Failed to parse receipt" }, 400);
    }
  }
}
