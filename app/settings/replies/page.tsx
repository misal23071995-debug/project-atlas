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
          <Link href="/settings" className="text-sm text-zinc-600 hover:text-zinc-800">
            ← Settings
          </Link>
          <h1 className="mt-2 text-3xl font-bold">Saved replies</h1>
          <p className="mt-1 text-zinc-600">
            Ready-made answers agents insert from the reply box on a ticket. Placeholders like {"{{customer_first_name}}"}{" "}
            are filled in for each ticket.
          </p>
        </div>

        {replies === null ? (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700">
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
