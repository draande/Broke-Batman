import { z } from "zod";
const suggestion = z.object({
  statusId: z.string().optional(),
  type: z.string().optional(),
  startsAt: z.string().datetime({ offset: true }).nullable().optional(),
  timezone: z.string().optional(),
  meetingURL: z.string().nullable().optional(),
  duration: z.number().positive().optional(),
});
export function suggestionDetails(value: unknown): z.infer<typeof suggestion> {
  const result = suggestion.safeParse(value);
  return result.success ? result.data : {};
}
