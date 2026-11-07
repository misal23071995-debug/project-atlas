import type { Metadata } from "next";
import { getSurveyTicket } from "@/app/lib/db/tickets";
import SurveyForm from "./SurveyForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rate your support",
  // Each link is private to one customer
  robots: { index: false, follow: false },
};

// Public page for customers (see proxy.ts): the private token in the link identifies the ticket
export default async function RatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ticket = await getSurveyTicket(token);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10 font-sans text-zinc-900">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8">
        {ticket ? (
          <>
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-lg font-semibold">
                {ticket.workspaceName[0]?.toUpperCase()}
              </div>
              <div>
                <h1 className="font-semibold">{ticket.workspaceName} Support</h1>
                <p className="text-sm text-zinc-600">
                  Ticket #{ticket.ticketId}: {ticket.subject}
                </p>
              </div>
            </div>
            {ticket.customerName && (
              <p className="mb-5 text-sm text-zinc-700">Hi {ticket.customerName.split(" ")[0]},</p>
            )}
            <SurveyForm token={token} rating={ticket.rating} comment={ticket.comment} />
          </>
        ) : (
          <div className="text-center">
            <h1 className="text-xl font-semibold">This link isn&apos;t valid</h1>
            <p className="mt-2 text-sm text-zinc-600">Please use the full link from your support message.</p>
          </div>
        )}
      </div>
    </main>
  );
}
