import { fromHono } from "chanfana";
import { Hono, Context } from "hono";
import { Parse } from "./endpoints/parse";
import { CheckApiKey } from "./endpoints/checkApiKey";
import { Models } from "./endpoints/models";
import { GetReceiptImage, UploadReceiptImage } from "./endpoints/receiptImages";
import { cors } from "hono/cors";
import { authMiddleware } from "./middleware/auth";

const app = new Hono<{ Bindings: Bindings }>();

app.use("/*", cors());
app.use("/api/*", authMiddleware);

const openapi = fromHono(app, {
  docs_url: "/docs",
});

openapi.post("/api/parse", Parse);
openapi.get("/api/check-key", CheckApiKey);
openapi.get("/api/models", Models);
openapi.post("/api/images", UploadReceiptImage);
openapi.get("/images/:file", GetReceiptImage);
app.get("/", (c) => c.redirect("/docs"));

export default app;

export interface Bindings {
  GEMINI_API_KEY: string;
  API_KEY: string;
  IMGPROXY_KEY: string;
  IMGPROXY_SALT: string; 
  IMGPROXY_URL: string;
  MINIO_ENDPOINT: string;
  MINIO_ACCESS_KEY: string;
  MINIO_SECRET_KEY: string;
  MINIO_BUCKET: string;
  MINIO_REGION: string;
}

export type AppContext = Context<{ Bindings: Bindings }>;