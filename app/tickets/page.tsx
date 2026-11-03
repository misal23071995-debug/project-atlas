import { listTickets } from "@/app/lib/db/tickets";
import { requireSession } from "@/app/lib/auth/session";
import TicketsView from "./TicketsView";

// Always read fresh tickets from the database
export const dynamic = "force-dynamic";

export default async function TicketsPage() {
  const { org } = await requireSession();
  const tickets = await listTickets(org.id);

  return <TicketsView tickets={tickets} />;
}
