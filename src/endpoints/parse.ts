import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { jsonSchemaToZod } from "@n8n/json-schema-to-zod";
import { receiptSchema } from "../../schema/receipt.v1";
import { GeminiService } from "../services/GeminiService";

// Just use the schema directly without transformation
const receiptResponseSchema = jsonSchemaToZod(receiptSchema);

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
              model: z.string().optional().describe("Model ID to use for parsing (optional)"),
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
            schema: receiptResponseSchema,
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
    const { image, model } = data.body;

    try {
      if (!image || !/^data:image\/\w+;base64,/.test(image)) {
        return c.json({ error: "Invalid image data" }, 400);
      }

      const geminiService = new GeminiService(c.env.GEMINI_API_KEY, model);
      const result = await geminiService.parseReceipt(image);

      const validatedResult = receiptResponseSchema.parse(result);
      return c.json(validatedResult);
    } catch (error) {
      return c.json({ error: error.message || "Failed to parse receipt" }, 400);
    }
  }
}
