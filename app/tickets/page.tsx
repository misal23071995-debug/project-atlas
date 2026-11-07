import { after } from "next/server";
import { listTickets } from "@/app/lib/db/tickets";
import { sweepTimedRules } from "@/app/lib/db/automation";
import { requireSession } from "@/app/lib/auth/session";
import TicketsView from "./TicketsView";

// Always read fresh tickets from the database
export const dynamic = "force-dynamic";

export default async function TicketsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = String((await searchParams).q ?? "").slice(0, 100);
  const { org } = await requireSession();
  // SLA-breach and waiting rules are checked in the background, after the page is sent
  after(() => sweepTimedRules(org.id));
  const tickets = await listTickets(org.id);

  // A new search from the top bar starts the view fresh
  return <TicketsView key={q} tickets={tickets} initialSearch={q} />;
}
