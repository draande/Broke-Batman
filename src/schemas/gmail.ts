import { z } from "zod";
export const googleToken = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
  expires_in: z.number().positive().optional(),
});
export const gmailProfile = z.object({ emailAddress: z.string().email() });
export const gmailPage = z.object({
  messages: z.array(z.object({ id: z.string().min(1) })).optional(),
  nextPageToken: z.string().optional(),
});
export type GmailPart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
  headers?: { name: string; value: string }[];
};
const part: z.ZodType<GmailPart> = z.lazy(() =>
  z.object({
    mimeType: z.string().optional(),
    body: z.object({ data: z.string().optional() }).optional(),
    parts: z.array(part).optional(),
    headers: z
      .array(z.object({ name: z.string(), value: z.string() }))
      .optional(),
  }),
);
export const gmailMessage = z.object({
  id: z.string().min(1),
  threadId: z.string(),
  internalDate: z
    .string()
    .regex(/^\d+$/)
    .refine((v) => Number.isFinite(new Date(Number(v)).getTime())),
  payload: part.optional(),
});
