import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { GeminiService } from "../services/GeminiService";
import { VisionModel } from "../types";

export class Models extends OpenAPIRoute {
  schema = {
    tags: ["Models"],
    summary: "Get available vision models for receipt parsing",
    security: [{ bearerAuth: [] }],
    responses: {
      "200": {
        description: "Returns available vision models",
        content: {
          "application/json": {
            schema: z.array(
              z.object({
                id: z.string(),
                name: z.string(),
                provider: z.string(),
              })
            ),
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
    try {
      const geminiService = new GeminiService(c.env.GEMINI_API_KEY);
      const models: VisionModel[] = geminiService.getModels();
      return c.json(models);
    } catch (error) {
      return c.json({ error: error.message || "Failed to retrieve models" }, 500);
    }
  }
}