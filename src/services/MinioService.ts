import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export class MinioService {
  private client: S3Client;
  private bucket: string;
  private region: string;
  private endpoint: string;

  constructor(
    endpoint: string,
    accessKey: string,
    secretKey: string,
    bucket: string,
    region: string = 'us-east-1'
  ) {
    this.bucket = bucket;
    this.region = region;
    this.endpoint = endpoint;
    
    this.client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      forcePathStyle: true // Required for MinIO
    });
  }

  /**
   * Upload data to MinIO/S3
   * @param key Object key (filename)
   * @param body File data
   * @param contentType Content type of the file
   * @returns Promise resolving to the object URL
   */
  async uploadObject(key: string, body: Uint8Array, contentType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType
    });

    await this.client.send(command);
    return `/${this.bucket}/${key}`;
  }
  
  /**
   * Get an object from MinIO/S3
   * @param key Object key (filename)
   * @returns Promise resolving to the object data
   */
  async getObject(key: string): Promise<Uint8Array> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key
    });

    const response = await this.client.send(command);
    const arrayBuffer = await response.Body.transformToByteArray();
    return arrayBuffer;
  }

  /**
   * Delete an object from MinIO/S3
   * @param key Object key (filename)
   */
  async deleteObject(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key
    });

    await this.client.send(command);
  }

  /**
   * Check if an object exists in MinIO/S3
   * @param key Object key (filename)
   * @returns Promise resolving to boolean indicating if object exists
   */
  async objectExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key
      });
      await this.client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Generate a pre-signed URL for accessing an object
   * @param key Object key (filename)
   * @param expiresIn Expiration time in seconds
   * @returns Promise resolving to pre-signed URL
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key
    });
    
    return getSignedUrl(this.client, command, { expiresIn });
  }
  
  /**
   * Get S3 URL for an object
   * @param key Object key (filename)
   * @returns S3 URL
   */
  getS3Url(key: string): string {
    return `s3://${this.bucket}/${key}`;
  }
}
