import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth";
import { AppShell } from "@/components/app-shell";
export const dynamic = "force-dynamic";
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await currentUser())) redirect("/login");
  return (
    <>
      <AppShell />
      {children}
    </>
  );
}
