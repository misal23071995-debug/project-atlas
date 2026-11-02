import DashboardLayout from "@/app/components/dashboard-layout";
import NewTicketForm from "./NewTicketForm";

export default function NewTicketPage() {
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold">New Ticket</h1>
        <p className="mt-1 text-zinc-400">
          Log a request that came in by phone, email or in person. Atlas AI adds the summary and intent.
        </p>

        <NewTicketForm />
      </div>
    </DashboardLayout>
  );
}
