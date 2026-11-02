import DashboardLayout from "@/app/components/dashboard-layout";
import { getTicket } from "@/app/lib/db/tickets";
import TicketDetailView from "./TicketDetailView";

// Always read the latest conversation from the database
export const dynamic = "force-dynamic";

export default async function TicketDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ticket = await getTicket(id);

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

  return <TicketDetailView ticket={ticket} />;
}
