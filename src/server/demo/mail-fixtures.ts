import type { MailInput } from "@/lib/email-intelligence";
export function demoMails(): MailInput[] {
  const interview = new Date(Date.now() + 86400000);
  interview.setUTCHours(17, 0, 0, 0);
  const deadline = new Date(Date.now() + 2 * 86400000).toISOString();
  return [
    {
      id: "demo-google",
      subject: "Google Software Engineer interview confirmation",
      sender: "Taylor Morgan <taylor@google.com>",
      body: `Google Software Engineer technical interview confirmed for ${interview.toISOString()}. Duration 45 minutes. Join https://meet.google.com/demo-interview`,
    },
    {
      id: "demo-stripe",
      subject: "Stripe Software Engineer application update",
      sender: "Hiring <careers@stripe.com>",
      body: "Thank you for applying for the Stripe Software Engineer role. Unfortunately we will not be moving forward with your application.",
    },
    {
      id: "demo-nvidia",
      subject: "NVIDIA Software Engineer opportunity",
      sender: "Alex Chen <alex@nvidia.com>",
      body: "I am a recruiter at NVIDIA. We have an opportunity for a Software Engineer role. Please reply with your availability.",
    },
    {
      id: "demo-wayne",
      subject: "Wayne Enterprises application received",
      sender: "Careers <careers@wayne.example>",
      body: "Wayne Enterprises has received your application for Software Engineer. Thank you for applying.",
    },
    {
      id: "demo-cyberdyne",
      subject: "Cyberdyne Software Engineer online assessment",
      sender: "Recruiting <recruiting@cyberdyne.example>",
      body: `Complete the online assessment for Cyberdyne Software Engineer. Deadline: ${deadline}`,
    },
  ].map((m) => ({ ...m, threadId: m.id, receivedAt: new Date(), demo: true }));
}
