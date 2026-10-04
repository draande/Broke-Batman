import type { Prisma } from "@prisma/client";
import type { applicationInclude } from "@/server/repositories/applications";
import type { computeAnalytics } from "@/lib/analytics";
export type Serialized<T> = T extends Date
  ? string
  : T extends Array<infer U>
    ? Serialized<U>[]
    : T extends object
      ? { [K in keyof T]: Serialized<T[K]> }
      : T;
export type Application = Serialized<
  Prisma.ApplicationGetPayload<{ include: typeof applicationInclude }>
> & { health?: string };
export type Analytics = ReturnType<typeof computeAnalytics>;
export type Status = {
  id: string;
  label: string;
  category: string;
  order: number;
};
export type Preference = {
  weeklyTarget: number;
  streakEnabled: boolean;
  theme: string;
  timezone: string;
};
export type AppRef = { id: string; company: string; position: string };
export type Interview = Application["interviews"][number] & {
  application: AppRef;
};
export type FollowUp = Application["followUps"][number] & {
  application: AppRef;
};
export type Bootstrap = {
  user: { id: string; name: string; email: string; preference: Preference };
  statuses: Status[];
  analytics: Analytics;
  activity: {
    id: string;
    message: string;
    createdAt: string;
    application: AppRef;
  }[];
  interviews: Interview[];
  followUps: FollowUp[];
  deadlines: (AppRef & { dueAt: string })[];
  choices: { companies: string[]; locations: string[]; sources: string[] };
};
export type Mail = Serialized<
  Prisma.EmailMessageMetadataGetPayload<{
    include: {
      actions: true;
      application: { select: { id: true; company: true; position: true } };
    };
  }>
>;
export type Inbox = {
  account: string;
  items: Mail[];
  total: number;
  page: number;
  pages: number;
  apps: AppRef[];
};
