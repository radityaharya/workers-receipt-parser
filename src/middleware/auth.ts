import { Context, Next } from "hono";
import { Bindings } from "../index";

export const authMiddleware = async (c: Context<{ Bindings: Bindings }>, next: Next) => {
  const authHeader = c.req.header("Authorization");

  // Skip auth for documentation
  if (c.req.path === "/docs") {
    return next();
  }
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid authorization header" }, 401);
  }

  const token = authHeader.substring(7);
  if (token !== c.env.API_KEY) {
    return c.json({ error: "Invalid API key" }, 401);
  }

  await next();
};
