import {
  GenerativeModel,
  GoogleGenerativeAI,
  Schema,
  SchemaType,
} from "@google/generative-ai";
import { receiptSchema } from "../../schema/receipt.zod";
import { z } from "zod";
import { ReceiptCalculator } from "../utils/ReceiptCalculator";
import { VisionModel } from "../types";

type ReceiptType = z.infer<typeof receiptSchema>;

const MODELS = [
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
  },
  {
    id: "gemini-2.0-pro-exp-02-05",
    name: "Gemini 2.0 Pro",
  },
  {
    id: "gemini-2.0-flash-lite",
    name: "Gemini 2.0 Lite",
  },
];

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private modelId: string;
  private cachedSchema: Schema | null = null;
  private defaultPrompt =
    "Parse this receipt into a JSON object. Combine date and time into an RFC3339 timestamp.";
  private maxRetries = 3;

  constructor(
    apiKey: string,
    modelId: string = MODELS[0].id,
    options?: {
      maxRetries?: number;
      defaultPrompt?: string;
    }
  ) {
    if (!apiKey) throw new Error("API key is required");

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.modelId = modelId;
    this.model = this.genAI.getGenerativeModel({
      model: modelId,
    });

    if (options?.maxRetries !== undefined) this.maxRetries = options.maxRetries;
    if (options?.defaultPrompt) this.defaultPrompt = options.defaultPrompt;
  }

  private convertZodSchemaToGeminiSchema(zodSchema: z.ZodType): Schema {
    // Return cached schema if available
    if (this.cachedSchema) return this.cachedSchema;

    const processZodType = (schema: z.ZodType): unknown => {
      if (schema instanceof z.ZodString) {
        return { type: SchemaType.STRING };
      } else if (schema instanceof z.ZodNumber) {
        return { type: SchemaType.NUMBER };
      } else if (schema instanceof z.ZodBoolean) {
        return { type: SchemaType.BOOLEAN };
      } else if (schema instanceof z.ZodArray) {
        return {
          type: SchemaType.ARRAY,
          items: processZodType(schema._def.type),
        };
      } else if (schema instanceof z.ZodObject) {
        const result: Record<string, unknown> = {
          type: SchemaType.OBJECT,
          properties: {},
          required: [],
        };

        const shape = schema._def.shape();

        // Process each property in the object
        for (const [key, value] of Object.entries(shape)) {
          result.properties[key] = processZodType(value as z.ZodType);

          // Check if property is required
          if (!(value instanceof z.ZodOptional)) {
            (result.required as string[]).push(key);
          }

          // Handle field descriptions
          if ((value as any)._def.description) {
            result.properties[key].description = (
              value as any
            )._def.description;
          }

          // Handle enums
          if (value instanceof z.ZodEnum) {
            result.properties[key].enum = value._def.values;
          }
        }

        // Remove required array if empty
        if ((result.required as string[]).length === 0) {
          delete result.required;
        }

        return result;
      } else if (schema instanceof z.ZodEnum) {
        return {
          type: SchemaType.STRING,
          enum: schema._def.values,
        };
      } else if (schema instanceof z.ZodOptional) {
        return processZodType(schema._def.innerType);
      } else {
        // Default fallback
        return { type: SchemaType.STRING };
      }
    };

    // Cache the converted schema
    this.cachedSchema = processZodType(zodSchema) as Schema;
    return this.cachedSchema;
  }

  private prepareSchema(): Schema {
    return this.convertZodSchemaToGeminiSchema(receiptSchema);
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    retries = this.maxRetries
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (retries <= 0) throw error;

      console.warn(
        `Operation failed, retrying... (${retries} attempts left)`,
        error.message
      );
      // Exponential backoff
      const delay = Math.min(1000 * 2 ** (this.maxRetries - retries), 10000);
      await new Promise((resolve) => setTimeout(resolve, delay));

      return this.retryOperation(operation, retries - 1);
    }
  }

  async parseReceipt(
    imageBase64: string,
    prompt?: string
  ): Promise<ReceiptType> {
    // Remove data:image/xxx;base64, prefix if present
    const base64Data = imageBase64.includes(",")
      ? imageBase64.split(",")[1]
      : imageBase64;

    const parseOperation = async () => {
      console.log(`Parsing receipt with model: ${this.modelId}`);

      const chatSession = this.model.startChat({
        generationConfig: {
          temperature: 1,
          topP: 0.95,
          topK: 64,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
          responseSchema: this.prepareSchema(),
        },
      });

      const result = await chatSession.sendMessage([
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Data,
          },
        },
        {
          text: prompt || this.defaultPrompt,
        },
      ]);

      try {
        const jsonResponse = JSON.parse(result.response.text());
        console.log("Successfully parsed receipt");
        const validatedReceipt = receiptSchema.parse(jsonResponse);
        return ReceiptCalculator.calculateDiscrepancy(validatedReceipt);
      } catch (error) {
        console.error("Failed to parse receipt response:", error.message);
        throw new Error(`Failed to parse receipt: ${error.message}`);
      }
    };

    return this.retryOperation(parseOperation);
  }

  async setModel(modelId: string): Promise<void> {
    if (!MODELS.some((model) => model.id === modelId)) {
      throw new Error(
        `Invalid model ID: ${modelId}. Available models: ${MODELS.map(
          (m) => m.id
        ).join(", ")}`
      );
    }

    this.modelId = modelId;
    this.model = this.genAI.getGenerativeModel({
      model: modelId,
    });
  }

  getModels(): VisionModel[] {
    return MODELS.map((model) => ({
      id: model.id,
      name: model.name,
      provider: "google",
    }));
  }
}
