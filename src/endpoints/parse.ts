import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { receiptSchema } from "../../schema/receipt.zod";
import { GeminiService } from "../services/GeminiService";
import { MinioService } from "../services/MinioService";
import { ImgProxyService } from "../services/imgProxyService";
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

      // Process & Upload image to MinIO with compression
      const imagePath = await this.processAndUploadImage(
        image,
        c.env.MINIO_ENDPOINT,
        c.env.MINIO_ACCESS_KEY,
        c.env.MINIO_SECRET_KEY,
        c.env.MINIO_BUCKET,
        c.env.MINIO_REGION,
        c.env.IMGPROXY_URL,
        c.env.IMGPROXY_KEY,
        c.env.IMGPROXY_SALT
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
   * Process and upload base64 image to MinIO S3 storage
   * This method first uploads to a temporary location, processes via ImgProxy,
   * then uploads the final compressed image to the permanent location
   * 
   * @param base64Image Base64 encoded image data
   * @param endpoint MinIO endpoint URL
   * @param accessKey MinIO access key
   * @param secretKey MinIO secret key
   * @param bucket MinIO bucket name
   * @param region MinIO region
   * @param imgproxyUrl ImgProxy base URL
   * @param imgproxyKey ImgProxy key
   * @param imgproxySalt ImgProxy salt
   * @returns Path of the uploaded image
   */
  private async processAndUploadImage(
    base64Image: string,
    endpoint: string,
    accessKey: string,
    secretKey: string,
    bucket: string,
    region: string,
    imgproxyUrl: string,
    imgproxyKey: string,
    imgproxySalt: string
  ): Promise<string> {
    const matches = base64Image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

    if (!matches || matches.length !== 3) {
      throw new Error("Invalid base64 image format");
    }

    const contentType = matches[1];
    const base64Data = matches[2];
    const fileExtension = this.getFileExtensionFromMimeType(contentType);

    const uuid = uuidv4();
    const tmpFilename = `tmp/${uuid}${fileExtension}`;
    const finalFilename = `${uuid}.webp`;

    const imageData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

    const minioService = new MinioService(endpoint, accessKey, secretKey, bucket, region);
    
    // 1. Upload the raw image to temp location in MinIO
    await minioService.uploadObject(tmpFilename, imageData, contentType);
    
    // 2. Get S3 URL for the tmp image
    const s3Url = minioService.getS3Url(tmpFilename);
    
    // 3. Initialize ImgProxy service and generate URL for optimized image
    const imgproxyService = new ImgProxyService(imgproxyUrl, imgproxyKey, imgproxySalt);
    const processedImageUrl = imgproxyService.generateUrl(s3Url, {
      quality: 70,
      format: 'webp',
      resize: 'fit',
    });
    
    // 4. Fetch the optimized image from ImgProxy
    const processedImage = await imgproxyService.fetchImage(processedImageUrl);
    
    // 5. Upload the processed image to the final location in MinIO
    await minioService.uploadObject(
      `receipts/${finalFilename}`,
      processedImage.data,
      processedImage.contentType
    );
    
    // 6. Delete the temporary file to avoid storing unnecessary files
    await minioService.deleteObject(tmpFilename);
    
    return `/images/${finalFilename}`;
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
