import DashboardLayout from "@/app/components/dashboard-layout";
import NewTicketForm from "./NewTicketForm";
import { redirect } from "next/navigation";
import { requireSession } from "@/app/lib/auth/session";
import { can } from "@/app/lib/auth/roles";

export default async function NewTicketPage() {
  const { role } = await requireSession();
  if (!can(role, "tickets.work")) redirect("/tickets");

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold">New ticket</h1>
        <p className="mt-1 text-zinc-600">
          Log a request that came in by phone, email or in person. Atlas AI adds the summary and intent.
        </p>

        <NewTicketForm />
      </div>
    </DashboardLayout>
  );
}
