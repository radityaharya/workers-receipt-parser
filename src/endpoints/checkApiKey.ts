import { OpenAPIRoute } from "chanfana";
import { z } from "zod";

export class CheckApiKey extends OpenAPIRoute {
  schema = {
    tags: ["Auth"],
    summary: "Check if the provided API key is valid",
    security: [{ bearerAuth: [] }],
    responses: {
      "200": {
        description: "API key is valid",
        content: {
          "application/json": {
            schema: z.object({
              valid: z.boolean(),
              message: z.string(),
            }),
          },
        },
      },
      "401": {
        description: "API key is invalid",
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
    // If this endpoint is reached, it means the auth middleware approved the request
    return c.json({
      valid: true,
      message: "API key is valid"
    });
  }
}
