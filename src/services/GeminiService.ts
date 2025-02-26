import {
  GenerativeModel,
  GoogleGenerativeAI,
  Schema,
  SchemaType,
} from "@google/generative-ai";
import { receiptSchema } from "../../schema/receipt.v1";
import { jsonSchemaToZod } from "@n8n/json-schema-to-zod";
import { z } from "zod";
import { ReceiptCalculator } from "../utils/ReceiptCalculator";

const receiptZodSchema = jsonSchemaToZod(receiptSchema);
type ReceiptType = z.infer<typeof receiptZodSchema>;

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
    });
  }

  private convertJsonSchemaToGeminiSchema(jsonSchema: object): Schema {
    const convert = (schema: unknown): unknown => {
      if (!schema || typeof schema !== "object") return schema;

      // Convert type
      if (schema["type"] === "string") return { type: SchemaType.STRING };
      if (schema["type"] === "number") return { type: SchemaType.NUMBER };
      if (schema["type"] === "boolean") return { type: SchemaType.BOOLEAN };
      if (schema["type"] === "array") {
        return {
          type: SchemaType.ARRAY,
          items: convert(schema["items"]),
        };
      }

      if (schema["type"] === "object") {
        const result: Record<string, unknown> = {
          type: SchemaType.OBJECT,
          properties: {},
        };

        if (schema["required"]) {
          result.required = schema["required"];
        }

        if (schema["properties"]) {
          Object.entries(schema["properties"]).forEach(([key, value]) => {
            result.properties[key] = convert(value);

            // Handle special cases
            if (value["format"] === "date-time") {
              result.properties[key].format = "date-time";
            }
            if (value["enum"]) {
              result.properties[key].enum = value["enum"];
            }
          });
        }

        return result;
      }

      return schema;
    };

    const { $schema, title, ...schemaWithoutMeta } = jsonSchema as Record<
      string,
      unknown
    >;
    return convert(schemaWithoutMeta) as Schema;
  }

  private prepareSchema(): Schema {
    return this.convertJsonSchemaToGeminiSchema(receiptSchema);
  }

  async parseReceipt(imageBase64: string): Promise<ReceiptType> {
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

    // Remove data:image/xxx;base64, prefix
    const base64Data = imageBase64.split(",")[1];

    const result = await chatSession.sendMessage([
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Data,
        },
      },
      {
        text: "Parse this receipt into a JSON object. Combine date and time into an RFC3339 timestamp.",
      },
    ]);

    try {
      const jsonResponse = JSON.parse(result.response.text());
      const validatedReceipt = receiptZodSchema.parse(jsonResponse);
      return ReceiptCalculator.calculateDiscrepancy(validatedReceipt);
    } catch (error) {
      throw new Error(`Failed to parse receipt: ${error.message}`);
    }
  }
}
