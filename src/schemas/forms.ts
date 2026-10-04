import { z } from "zod";
const optionalText = z.string().max(200).optional().nullable();
export const webURL = z
  .string()
  .url()
  .max(2048)
  .refine((v) => {
    try {
      return ["http:", "https:"].includes(new URL(v).protocol);
    } catch {
      return false;
    }
  }, "Use an http or https URL");
const url = z
  .union([webURL, z.literal(""), z.null()])
  .optional()
  .transform((v) => v || null);
const date = z
  .union([
    z.string().datetime({ offset: true }),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((v) => {
        const parsed = new Date(v);
        return !isNaN(+parsed) && parsed.toISOString().slice(0, 10) === v;
      }, "Invalid calendar date"),
    z.literal(""),
    z.null(),
  ])
  .optional()
  .transform((v) =>
    v ? new Date(v.length === 10 ? `${v}T12:00:00Z` : v) : null,
  )
  .refine((v) => !v || !isNaN(v.getTime()), "Invalid date");
const salary = z
  .union([z.coerce.number().min(0).max(100000000), z.null()])
  .optional();
export const applicationSchema = z
  .object({
    company: z.string().trim().min(1).max(200),
    position: z.string().trim().min(1).max(200),
    companyLogo: url,
    jobPostingURL: url,
    jobDescription: z.string().max(100000).default(""),
    location: z.string().max(200).default(""),
    workMode: z.enum(["Remote", "Hybrid", "On-site"]).default("Remote"),
    employmentType: z
      .enum(["Internship", "Full-time", "Part-time", "Contract"])
      .default("Full-time"),
    salaryMinimum: salary,
    salaryMaximum: salary,
    salaryCurrency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .default("USD"),
    datePosted: date,
    dateApplied: date,
    applicationDeadline: date,
    statusId: z.string().min(1).max(80).default("saved"),
    source: z.string().max(200).default("Direct"),
    experienceRequirements: z.string().max(5000).default(""),
    requiredSkills: z
      .array(z.string().trim().min(1).max(80))
      .max(100)
      .default([]),
    preferredSkills: z
      .array(z.string().trim().min(1).max(80))
      .max(100)
      .default([]),
    notes: z.string().max(20000).default(""),
    contactName: optionalText,
    contactEmail: z.union([z.string().email(), z.literal("")]).optional(),
    recruiterName: optionalText,
    recruiterEmail: z.union([z.string().email(), z.literal("")]).optional(),
    allowDuplicate: z.boolean().default(false),
  })
  .refine(
    (v) =>
      v.salaryMinimum == null ||
      v.salaryMaximum == null ||
      v.salaryMaximum >= v.salaryMinimum,
    {
      path: ["salaryMaximum"],
      message: "Maximum salary must be at least the minimum",
    },
  );
export const interviewSchema = z.object({
  type: z.enum([
    "Recruiter",
    "Phone",
    "Technical",
    "Behavioral",
    "System Design",
    "Hiring Manager",
    "Onsite",
    "Final",
  ]),
  startsAt: z
    .string()
    .datetime({ offset: true })
    .transform((v) => new Date(v)),
  timezone: z
    .string()
    .max(80)
    .refine((v) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }, "Invalid timezone"),
  interviewer: z.string().max(200).default(""),
  meetingURL: url,
  notes: z.string().max(20000).default(""),
  preparationNotes: z.string().max(20000).default(""),
  outcome: z
    .enum(["Scheduled", "Completed", "Passed", "Declined", "Cancelled"])
    .default("Scheduled"),
});
export const followUpSchema = z.object({
  title: z.string().trim().min(1).max(300),
  dueAt: z
    .string()
    .datetime({ offset: true })
    .transform((v) => new Date(v)),
});
export const contactSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.union([z.string().email(), z.literal("")]).default(""),
  role: z.string().min(1).max(100).default("Recruiter"),
});
export const preferenceSchema = z.object({
  weeklyTarget: z.number().int().min(1).max(500),
  streakEnabled: z.boolean(),
  theme: z.enum(["dark", "light"]),
  timezone: interviewSchema.shape.timezone,
});
