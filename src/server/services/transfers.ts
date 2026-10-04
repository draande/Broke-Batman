import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { applicationSchema } from "@/schemas/forms";
import { APIError } from "@/server/errors";
import { db } from "@/server/db";
import { applicationInclude } from "@/server/repositories/applications";
export const importFields = [
  "company",
  "position",
  "location",
  "workMode",
  "employmentType",
  "salaryMinimum",
  "salaryMaximum",
  "salaryCurrency",
  "dateApplied",
  "datePosted",
  "applicationDeadline",
  "statusId",
  "source",
  "jobPostingURL",
  "jobDescription",
  "notes",
  "contactName",
  "contactEmail",
  "recruiterName",
  "recruiterEmail",
  "requiredSkills",
  "preferredSkills",
  "experienceRequirements",
];
export function previewCSV(csv: string, mapping: Record<string, string> = {}) {
  if (Buffer.byteLength(csv) > 1_000_000)
    throw new APIError(413, "CSV must be under 1 MB.");
  let raw: Record<string, string>[];
  try {
    raw = parse(csv, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      trim: true,
      max_record_size: 120000,
    });
  } catch {
    throw new APIError(422, "Invalid CSV. Check quotes and column counts.");
  }
  if (!raw.length || raw.length > 500)
    throw new APIError(422, "Import between 1 and 500 rows at a time.");
  const headers = Object.keys(raw[0]);
  const rows = raw.map((row, index) => {
    const mapped: Record<string, unknown> = {};
    for (const field of importFields) {
      const key = mapping[field] || (headers.includes(field) ? field : "");
      if (key && row[key] !== undefined && row[key] !== "")
        mapped[field] = ["requiredSkills", "preferredSkills"].includes(field)
          ? row[key]
              .split(";")
              .map((s) => s.trim())
              .filter(Boolean)
          : row[key];
    }
    const result = applicationSchema.safeParse(mapped);
    return {
      row: index + 2,
      data: mapped,
      errors: result.success
        ? []
        : result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`),
    };
  });
  return { headers, rows, valid: rows.every((r) => !r.errors.length) };
}
const formulaSafe = (v: unknown) =>
  typeof v === "string" && /^[\s]*[=+@-]/.test(v) ? `'${v}` : v;
export async function exportData(userId: string, format: string) {
  const apps = await db.application.findMany({
    where: { userId },
    include: applicationInclude,
    orderBy: { createdAt: "desc" },
  });
  if (format === "json")
    return new Response(
      JSON.stringify(
        {
          version: 2,
          profile: await db.searchProfile.findUnique({ where: { userId } }),
          skillsProfile: await db.userSkill.findMany({ where: { userId } }),
          preferences: await db.userPreference.findUnique({
            where: { userId },
          }),
          emailMetadata: await db.emailMessageMetadata.findMany({
            where: { userId },
            include: { actions: true },
          }),
          notifications: await db.notification.findMany({ where: { userId } }),
          exportedAt: new Date().toISOString(),
          applications: apps.map(({ userId: _user, ...app }) => {
            void _user;
            return app;
          }),
        },
        null,
        2,
      ),
      {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition":
            'attachment; filename="broke-batman-backup.json"',
          "Cache-Control": "no-store",
        },
      },
    );
  const rows = apps.map((a) =>
    Object.fromEntries(
      importFields.map((field) => {
        const value =
          field === "notes"
            ? a.notes.map((n) => n.body).join("\n\n")
            : field === "requiredSkills" || field === "preferredSkills"
              ? a.skills
                  .filter((s) => s.preferred === (field === "preferredSkills"))
                  .map((s) => s.skill.name)
                  .join(";")
              : field === "contactName"
                ? a.contacts.find((c) => c.role !== "Recruiter")?.name
                : field === "contactEmail"
                  ? a.contacts.find((c) => c.role !== "Recruiter")?.email
                  : field === "recruiterName"
                    ? a.contacts.find((c) => c.role === "Recruiter")?.name
                    : field === "recruiterEmail"
                      ? a.contacts.find((c) => c.role === "Recruiter")?.email
                      : a[field as keyof typeof a];
        return [
          field,
          formulaSafe(
            value instanceof Date ? value.toISOString() : (value ?? ""),
          ),
        ];
      }),
    ),
  );
  return new Response(
    stringify(rows, { header: true, columns: importFields }),
    {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="broke-batman-cases.csv"',
        "Cache-Control": "no-store",
      },
    },
  );
}
