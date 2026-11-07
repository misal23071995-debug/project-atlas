import Link from "next/link";
import DashboardLayout from "@/app/components/dashboard-layout";
import { requireSession } from "@/app/lib/auth/session";
import { can } from "@/app/lib/auth/roles";
import { listSavedReplies } from "@/app/lib/db/replies";
import RepliesManager from "./RepliesManager";

export const dynamic = "force-dynamic";

export default async function SavedRepliesPage() {
  const { org, role } = await requireSession();
  const replies = await listSavedReplies(org.id);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <Link href="/settings" className="text-xs font-medium text-zinc-500 hover:text-zinc-800">
            ← Settings
          </Link>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-900">Saved replies</h1>
          <p className="mt-0.5 max-w-3xl text-sm text-zinc-500">
            Ready-made answers agents insert from the reply box on a ticket. Placeholders like {"{{customer_first_name}}"}{" "}
            are filled in for each ticket.
          </p>
        </div>

        {replies === null ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Saved replies aren&apos;t set up yet. Run supabase/migrations/012_csat_saved_replies.sql in the Supabase SQL
            Editor.
          </p>
        ) : (
          <RepliesManager replies={replies} canEdit={can(role, "replies.manage")} />
        )}
      </div>
    </DashboardLayout>
  );
}
