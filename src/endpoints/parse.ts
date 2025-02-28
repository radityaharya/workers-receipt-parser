import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { receiptSchema } from "../../schema/receipt.zod";
import { GeminiService } from "../services/GeminiService";
import { ReceiptCalculator } from "../utils/ReceiptCalculator";
import { ReceiptValidator } from "../utils/ReceiptValidator";
import { validationResultSchema } from "../utils/ValidationTypes";
import { v4 as uuidv4 } from 'uuid';
import type { AppContext } from "../index";

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

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { image, model, validate = true } = data.body;

    try {
      if (!image || !/^data:image\/\w+;base64,/.test(image)) {
        return c.json({ error: "Invalid image data" }, 400);
      }

      // Upload image to R2 storage
      const imagePath = await this.uploadImageToR2(
        image,
        c.env.receipts_storage
      );

      const geminiService = new GeminiService(c.env.GEMINI_API_KEY, model);
      const result = await geminiService.parseReceipt(image);

      // Add image path to the result
      const resultWithImagePath = {
        ...result,
        image_path: imagePath,
      };

      // Calculate discrepancy
      const receiptWithDiscrepancy =
        ReceiptCalculator.calculateDiscrepancy(resultWithImagePath);

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

  /**
   * Upload base64 image to R2 storage with a UUID filename
   * @param base64Image Base64 encoded image data
   * @param r2Bucket R2 bucket instance
   * @returns URL of the uploaded image
   */
  private async uploadImageToR2(
    base64Image: string,
    r2Bucket: R2Bucket
  ): Promise<string> {
    // Extract content type and base64 data
    const matches = base64Image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

    if (!matches || matches.length !== 3) {
      throw new Error("Invalid base64 image format");
    }

    const contentType = matches[1];
    const base64Data = matches[2];
    const fileExtension = this.getFileExtensionFromMimeType(contentType);

    // Generate UUID filename
    const filename = `${uuidv4()}${fileExtension}`;

    // Decode base64 data
    const imageData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

    // Upload to R2
    await r2Bucket.put(filename, imageData, {
      httpMetadata: { contentType },
    });

    // Return the URL path of the uploaded image - now uses our endpoint
    return `/images/${filename}`;
  }

  /**
   * Get file extension from MIME type
   * @param mimeType MIME type string
   * @returns File extension including the dot
   */
  private getFileExtensionFromMimeType(mimeType: string): string {
    const extensions: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/gif": ".gif",
      "image/webp": ".webp",
      "image/bmp": ".bmp",
      "image/tiff": ".tiff",
      "image/svg+xml": ".svg",
    };

    return extensions[mimeType] || ".jpg";
  }
}
