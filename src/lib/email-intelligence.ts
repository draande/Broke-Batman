export const categories = [
  "APPLICATION_CONFIRMATION",
  "ONLINE_ASSESSMENT",
  "RECRUITER_MESSAGE",
  "INTERVIEW_REQUEST",
  "INTERVIEW_CONFIRMATION",
  "FOLLOW_UP",
  "REJECTION",
  "OFFER",
  "APPLICATION_UPDATE",
  "UNKNOWN",
] as const;
export type MailInput = {
  id: string;
  threadId: string;
  subject: string;
  sender: string;
  body: string;
  receivedAt: Date;
  demo?: boolean;
};
const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
export function classifyEmail(
  mail: Pick<MailInput, "subject" | "body" | "sender">,
) {
  const text = `${mail.subject}\n${mail.body}`;
  const rules: [(typeof categories)[number], RegExp][] = [
    [
      "REJECTION",
      /(?:not|won.t|unable to) (?:be )?(?:moving|move|proceed)|other candidates|unfortunately.{0,90}(?:application|position|role)/i,
    ],
    [
      "OFFER",
      /(?:pleased|delighted|happy) to offer|offer (?:of employment|letter)|employment offer/i,
    ],
    [
      "ONLINE_ASSESSMENT",
      /online assessment|coding (?:assessment|challenge)|complete.{0,50}assessment/i,
    ],
    [
      "INTERVIEW_CONFIRMATION",
      /interview (?:confirmed|confirmation|scheduled)|confirmed.{0,50}interview/i,
    ],
    [
      "INTERVIEW_REQUEST",
      /interview|availability.{0,60}(?:call|meet)|schedule.{0,50}(?:call|conversation)/i,
    ],
    [
      "APPLICATION_CONFIRMATION",
      /(?:received|thank you for|thanks for).{0,60}(?:application|applying)|application.{0,30}received/i,
    ],
    [
      "RECRUITER_MESSAGE",
      /recruiter|talent acquisition|recruiting team|opportunity.{0,50}(?:role|position)/i,
    ],
    ["FOLLOW_UP", /following up|follow.up.{0,50}(?:application|interview)/i],
    [
      "APPLICATION_UPDATE",
      /application status|application update|hiring process/i,
    ],
  ];
  const category = rules.find(([, r]) => r.test(text))?.[0] || "UNKNOWN";
  return {
    category,
    confidence: category === "UNKNOWN" ? 0 : 75,
    reason:
      category === "UNKNOWN"
        ? "No job-search rule matched"
        : "Deterministic phrase match; review the original email before acting",
  };
}
export function matchEmail(
  mail: Pick<MailInput, "subject" | "body" | "sender">,
  apps: {
    id: string;
    company: string;
    position: string;
    jobPostingURL?: string | null;
    contacts: { email: string }[];
  }[],
) {
  const text = normalize(`${mail.subject} ${mail.body}`),
    sender = mail.sender.toLowerCase();
  const ranked = apps
    .map((a) => {
      const reasons: string[] = [];
      let confidence = 0;
      if (text.includes(normalize(a.company))) {
        confidence += 40;
        reasons.push("Company appears in message");
      }
      const domain = sender.match(/@([^>\s]+)/)?.[1] || "";
      if (domain.split(".")[0] === normalize(a.company).replace(/ /g, "")) {
        confidence += 20;
        reasons.push("Sender domain matches company");
      }
      const words = normalize(a.position)
        .split(" ")
        .filter((w) => w.length > 2);
      const overlap = words.length
        ? words.filter((w) => text.split(" ").includes(w)).length / words.length
        : 0;
      if (overlap) {
        confidence += Math.round(overlap * 25);
        reasons.push("Role words match");
      }
      if (
        a.contacts.some(
          (c) => c.email && sender.includes(c.email.toLowerCase()),
        )
      ) {
        confidence += 30;
        reasons.push("Known recruiter email");
      }
      if (a.jobPostingURL && mail.body.includes(a.jobPostingURL)) {
        confidence += 40;
        reasons.push("Exact posting URL");
      }
      if (mail.body.includes(a.id)) {
        confidence += 65;
        reasons.push("Exact case reference ID");
      }
      if (a.jobPostingURL) {
        try {
          const url = new URL(a.jobPostingURL);
          const ids = ["jobId", "job_id", "gh_jid", "requisitionId", "jk"]
            .map((k) => url.searchParams.get(k))
            .filter((v): v is string => !!v);
          const pathId = url.pathname.split("/").filter(Boolean).at(-1);
          if (pathId && /\d{4,}/.test(pathId)) ids.push(pathId);
          if (ids.some((id) => mail.body.includes(id))) {
            confidence += 35;
            reasons.push("Posting job identifier appears in message");
          }
        } catch {
          /* Existing invalid legacy URLs contribute no evidence. */
        }
      }
      return {
        applicationId: a.id,
        confidence: Math.min(100, confidence),
        reasons,
      };
    })
    .sort((a, b) => b.confidence - a.confidence);
  const best = ranked[0];
  const ambiguous =
    !!best && !!ranked[1] && best.confidence - ranked[1].confidence < 15;
  return {
    applicationId:
      best && best.confidence >= 65 && !ambiguous ? best.applicationId : null,
    confidence: best?.confidence || 0,
    reasons: [
      ...(best?.reasons || []),
      ...(ambiguous ? ["Multiple cases match; choose a case"] : []),
    ],
  };
}
export function emailActions(mail: MailInput, category: string) {
  const actions: {
    kind: string;
    payload: Record<string, string | number | null>;
  }[] = [];
  const status: Record<string, string> = {
    APPLICATION_CONFIRMATION: "applied",
    ONLINE_ASSESSMENT: "oa",
    INTERVIEW_REQUEST: "recruiter-screen",
    INTERVIEW_CONFIRMATION: "technical-interview",
    REJECTION: "rejected",
    OFFER: "offer",
  };
  if (status[category])
    actions.push({ kind: "status", payload: { statusId: status[category] } });
  const url = mail.body.match(
    /https:\/\/(?:[\w-]+\.)?(?:zoom\.us|meet\.google\.com|teams\.microsoft\.com)\/[^\s<>]+/i,
  )?.[0];
  const timestamp = mail.body.match(
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})/,
  )?.[0];
  if (category.startsWith("INTERVIEW"))
    actions.push({
      kind: "interview",
      payload: {
        startsAt: timestamp && !isNaN(Date.parse(timestamp)) ? timestamp : null,
        timezone:
          mail.body.match(
            /\b(?:America|Europe|Asia|Australia|Pacific|Africa)\/[A-Za-z_]+(?:\/[A-Za-z_]+)?\b/,
          )?.[0] || "UTC",
        type: /technical/i.test(mail.body) ? "Technical" : "Recruiter",
        meetingURL: url || null,
        duration: Number(
          mail.body.match(/(\d+)\s*(?:minutes?|mins?)\b/i)?.[1] || 30,
        ),
      },
    });
  if (
    [
      "RECRUITER_MESSAGE",
      "INTERVIEW_REQUEST",
      "INTERVIEW_CONFIRMATION",
    ].includes(category)
  ) {
    const email = mail.sender.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0];
    if (email && !/no.?reply|notifications/i.test(email))
      actions.push({
        kind: "contact",
        payload: {
          email: email.toLowerCase(),
          name: mail.sender.split("<")[0].replace(/"/g, "").trim() || email,
          role: "Recruiter",
        },
      });
  }
  const deadline = mail.body.match(
    /deadline[:\s]+(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))/i,
  )?.[1];
  if (category === "ONLINE_ASSESSMENT" && deadline)
    actions.push({
      kind: "assessment",
      payload: { dueAt: deadline, title: "Complete online assessment" },
    });
  if (
    /availability/i.test(mail.body) &&
    ["RECRUITER_MESSAGE", "INTERVIEW_REQUEST"].includes(category)
  )
    actions.push({
      kind: "followup",
      payload: {
        title: "Reply with interview availability",
        dueAt: new Date(+mail.receivedAt + 86400000).toISOString(),
      },
    });
  return actions;
}
