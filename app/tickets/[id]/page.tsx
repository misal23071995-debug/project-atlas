import DashboardLayout from "@/app/components/dashboard-layout";
import { getTicket } from "@/app/lib/db/tickets";
import { listMembers, requireSession } from "@/app/lib/auth/session";
import { listSavedReplies } from "@/app/lib/db/replies";
import TicketDetailView from "./TicketDetailView";

// Always read the latest conversation from the database
export const dynamic = "force-dynamic";

export default async function TicketDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { org } = await requireSession();
  const [ticket, members, savedReplies] = await Promise.all([
    getTicket(org.id, id),
    listMembers(org.id),
    listSavedReplies(org.id),
  ]);

  if (!ticket) {
    return (
      <DashboardLayout>
        <div className="p-10 text-center">
          <h1 className="text-2xl font-bold">
            Ticket not found
          </h1>

          <p className="mt-2 text-zinc-500">
            This ticket does not exist.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <TicketDetailView
      ticket={ticket}
      agentNames={members.filter((m) => m.role !== "qa").map((m) => m.name)}
      savedReplies={savedReplies ?? []}
    />
  );
}
