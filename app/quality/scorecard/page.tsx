import Link from "next/link";
import { redirect } from "next/navigation";
import DashboardLayout from "@/app/components/dashboard-layout";
import { requireSession } from "@/app/lib/auth/session";
import { can } from "@/app/lib/auth/roles";
import { getScorecard } from "@/app/lib/db/quality";
import ScorecardEditor from "./ScorecardEditor";

export const dynamic = "force-dynamic";

export default async function ScorecardPage() {
  const { org, role } = await requireSession();
  if (!can(role, "quality.scorecard")) redirect("/quality");

  const criteria = await getScorecard(org.id);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl">
        <Link href="/quality" className="text-sm text-zinc-600 hover:text-zinc-800">
          ← Quality
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">Scorecard</h1>
        <p className="mt-1 text-zinc-600">
          What a good conversation looks like at {org.name}. Reviewers and the AI score each item from 1 to 5, and
          the weights decide how much each one counts. Reviews already done keep the scorecard they were made with.
        </p>
        <ScorecardEditor initial={criteria} />
      </div>
    </DashboardLayout>
  );
}
