import { z } from "zod";
export function environment() {
  return z
    .object({
      DATABASE_URL: z.string().url(),
      SESSION_SECRET: z.string().min(32),
      APP_URL: z.string().url(),
    })
    .parse(process.env);
}
