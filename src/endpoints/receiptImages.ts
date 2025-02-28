import { OpenAPIRoute, Str } from "chanfana";
import { AppContext } from "index";
import { z } from "zod";
import { MinioService } from "../services/MinioService";

export class GetReceiptImage extends OpenAPIRoute {
  schema = {
    tags: ["Images"],
    summary: "Get a receipt image",
    request: {
      params: z.object({
        file: z.string().describe("Filename of the image"),
      }),
    },
    responses: {
      "200": {
        description: "Returns the image file",
        content: {
          "image/webp": {
            schema: Str(),
          },
        },
      },
      "404": {
        description: "Image not found",
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

    if (!data.params || !data.params.file) {
      return c.json({ error: "Filename is required" }, 400);
    }

    const { file: filename } = data.params;

    console.log(`Fetching image: ${filename}`);

    try {
      const minioService = new MinioService(
        c.env.MINIO_ENDPOINT,
        c.env.MINIO_ACCESS_KEY,
        c.env.MINIO_SECRET_KEY,
        c.env.MINIO_BUCKET,
        c.env.MINIO_REGION
      );

      // Check if file exists errors for some reason
      // console.log(`Checking if image exists: ${c.env.MINIO_BUCKET}/${filename}`);
      // const exists = await minioService.objectExists(
      //   `${c.env.MINIO_BUCKET}/${filename}`
      // );
      // if (!exists) {
      //   return c.json({ error: "Image not found" }, 404);
      // }

      console.log(`Fetching image: receipts/${filename}`);
      // Get file from MinIO
      const imageData = await minioService.getObject(
        `receipts/${filename}`
      );

      // Determine content type based on file extension
      console.log(`Image data length: ${imageData.length}`);
      const contentType = this.getContentTypeFromFilename(filename);

      // Return the image
      return new Response(imageData, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000",
        },
      });
    } catch (error) {
      return c.json({ error: error.message || "Failed to get image" }, 500);
    }
  }

  /**
   * Get content type from filename
   * @param filename Filename with extension
   * @returns Content type string
   */
  private getContentTypeFromFilename(filename: string): string {
    const extension = filename.split(".").pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      bmp: "image/bmp",
      svg: "image/svg+xml",
    };

    return contentTypes[extension] || "application/octet-stream";
  }
}

// TODO: use minio
export class UploadReceiptImage extends OpenAPIRoute {
  schema = {
    tags: ["Images"],
    summary: "Upload a receipt image",
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              image: z.string().describe("Base64 encoded image data"),
            }),
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Returns the URL of the uploaded image",
        content: {
          "application/json": {
            schema: z.object({
              url: z.string(),
            }),
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
    const { image } = data.body;

    try {
      if (!image || !/^data:image\/\w+;base64,/.test(image)) {
        return c.json({ error: "Invalid image data" }, 400);
      }

      // Extract content type and base64 data
      const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

      if (!matches || matches.length !== 3) {
        return c.json({ error: "Invalid base64 image format" }, 400);
      }

      const contentType = matches[1];
      const base64Data = matches[2];
      const fileExtension = this.getFileExtensionFromMimeType(contentType);

      const filename = `${crypto.randomUUID()}${fileExtension}`;

      const imageData = Uint8Array.from(atob(base64Data), (c) =>
        c.charCodeAt(0)
      );

      await c.env.RECEIPT_STORAGE.put(filename, imageData, {
        httpMetadata: { contentType },
      });

      return c.json({
        url: `/images/${filename}`,
      });
    } catch (error) {
      return c.json({ error: error.message || "Failed to upload image" }, 400);
    }
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
