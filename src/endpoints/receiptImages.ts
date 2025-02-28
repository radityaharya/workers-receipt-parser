import { OpenAPIRoute, Str } from "chanfana";
import { AppContext } from "index";
import { z } from "zod";

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
        description: "Returns the requested image",
        content: {
          "image/jpeg": {
            schema: Str({}),
          },
          "image/png": {
            schema: Str({}),
          },
          "image/gif": {
            schema: Str({}),
          },
          "image/webp": {
            schema: Str({}),
          },
          "image/bmp": {
            schema: Str({}),
          },
          "image/tiff": {
            schema: Str({}),
          },
          "image/svg+xml": {
            schema: Str({}),
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

    const { file } = data.params;

    try {
      const object = await c.env.receipts_storage.get(file);

      if (!object) {
        return c.json({ error: "Image not found" }, 404);
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      headers.set("Cache-Control", "public, max-age=31536000");

      return new Response(object.body, {
        headers,
      });
    } catch (error) {
      return c.json(
        { error: error.message || "Failed to retrieve image" },
        500
      );
    }
  }
}

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
