import { fromHono } from "chanfana";
import { Hono } from "hono";
import { Parse } from "./endpoints/parse";
import { CheckApiKey } from "./endpoints/checkApiKey";
import { cors } from "hono/cors";
import { authMiddleware } from "./middleware/auth";

const app = new Hono();

app.use("/*", cors());
app.use("/api/*", authMiddleware);

const openapi = fromHono(app, {
  docs_url: "/docs",
});

openapi.post("/api/parse", Parse);
openapi.get("/api/check-key", CheckApiKey);

export default app;

export interface Bindings {
  GEMINI_API_KEY: string;
  API_KEY: string;
}
