import pb from "@bitpatty/imgproxy-url-builder";
import type { ResizeType, GravityType } from "@bitpatty/imgproxy-url-builder";

/**
 * Options for generating imgproxy URLs
 */
export interface ImgProxyOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: "webp" | "jpg" | "png" | "gif";
  resize?: "fit" | "fill" | "auto";
  gravity?: "no" | "so" | "ea" | "we" | "ce" | "sm";
  blur?: number;
  rotate?: number;
}

/**
 * Response from fetching an image from imgproxy
 */
export interface ImageResponse {
  data: Uint8Array;
  contentType: string;
}

/**
 * Service for interacting with imgproxy
 */
export class ImgProxyService {
  private baseUrl: string;
  private key: string;
  private salt: string;

  /**
   * Create an ImgProxyService instance
   * @param baseUrl Base URL of the imgproxy instance
   * @param key Key for signing URLs
   * @param salt Salt for signing URLs
   */
  constructor(baseUrl: string, key: string, salt: string) {
    this.baseUrl = baseUrl;
    this.key = key;
    this.salt = salt;
  }

  /**
   * Generate a signed imgproxy URL for processing an image
   * @param imagePath Path to the image (can be S3 URL)
   * @param options Processing options
   * @returns Signed URL for accessing the processed image
   */
  generateUrl(imagePath: string, options: ImgProxyOptions): string {
    const builder = pb();

    // Set resize options
    if (options.width || options.height) {
      // Define resize options
      const resizeOptions: any = {};
      if (options.width) resizeOptions.width = options.width;
      if (options.height) resizeOptions.height = options.height;

      // Add resize type if specified
      if (options.resize) {
        // Convert string to enum value to satisfy the type requirements
        const resizeType = options.resize as unknown as ResizeType;
        resizeOptions.type = resizeType;
      }

      builder.resize(resizeOptions);
    }

    if (options.quality) {
      builder.quality(options.quality);
    }

    if (options.format) {
      builder.format(options.format);
    }

    if (options.blur) {
      builder.blur(options.blur);
    }

    // Handle gravity if provided
    if (options.gravity) {
      // Convert string to enum value to satisfy the type requirements
      const gravityType = options.gravity as unknown as GravityType;
      builder.gravity({ type: gravityType });
    }

    // Build URL with signature
    return builder.build({
      path: imagePath,
      baseUrl: this.baseUrl,
      signature: {
        key: this.key,
        salt: this.salt,
      },
    });
  }

  /**
   * Fetch an image from imgproxy
   * @param url The imgproxy URL to fetch from
   * @returns Promise resolving to image data and content type
   */
  async fetchImage(url: string): Promise<ImageResponse> {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Failed to fetch image: ${response.status} ${response.statusText}`
        );
      }

      const contentType = response.headers.get("content-type") || "image/webp";
      const arrayBuffer = await response.arrayBuffer();

      return {
        data: new Uint8Array(arrayBuffer),
        contentType,
      };
    } catch (error) {
      throw new Error(
        `ImgProxy fetch failed: ${error.message || "Unknown error"}`
      );
    }
  }
}
