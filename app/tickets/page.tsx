import { listTickets } from "@/app/lib/db/tickets";
import TicketsView from "./TicketsView";

// Always read fresh tickets from the database
export const dynamic = "force-dynamic";

export default async function TicketsPage() {
  const tickets = await listTickets();

  return <TicketsView tickets={tickets} />;
}
