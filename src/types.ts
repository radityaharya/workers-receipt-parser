declare module 'hono' {
  interface ContextRenderer {
    (content: string | Promise<string>): Response
  }
}

export interface VisionModel {
  id: string;
  name: string;
  provider: string;
}