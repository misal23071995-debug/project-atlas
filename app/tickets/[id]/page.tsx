import DashboardLayout from "@/app/components/dashboard-layout";
import { getTicket } from "@/app/lib/db/tickets";
import { listMembers, requireSession } from "@/app/lib/auth/session";
import { listSavedReplies } from "@/app/lib/db/replies";
import { listCustomerOrders } from "@/app/lib/db/orders";
import { getSupabase } from "@/app/lib/db/supabase";
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

  const [orders, others] = await Promise.all([
    listCustomerOrders(org.id, ticket.customer.id),
    getSupabase()
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.id)
      .eq("customer_id", ticket.customer.id)
      .neq("id", ticket.id),
  ]);

  return (
    <TicketDetailView
      orders={orders}
      otherTickets={others.count ?? 0}
      ticket={ticket}
      agentNames={members.filter((m) => m.role !== "qa").map((m) => m.name)}
      savedReplies={savedReplies ?? []}
    />
  );
}
