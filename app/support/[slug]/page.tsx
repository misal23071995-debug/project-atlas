import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getWorkspaceBySlug } from "@/app/lib/db/workspaces";
import SupportChat from "../SupportChat";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

// Example questions for the demo brand; other workspaces start with an empty box
const DEMO_SUGGESTIONS = [
  "My ring isn't syncing",
  "How long does the battery last?",
  "What is your return policy?",
  "How do I find my ring size?",
];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const workspace = await getWorkspaceBySlug((await params).slug);
  return {
    title: workspace ? `${workspace.name} Support` : "Support",
    description: workspace ? `Get help from the ${workspace.name} support assistant.` : undefined,
  };
}

// Public page for customers: no sign-in needed (see proxy.ts). Each workspace has its own link.
export default async function SupportPage({ params }: Props) {
  const workspace = await getWorkspaceBySlug((await params).slug);
  if (!workspace) notFound();

  return (
    <main className="flex min-h-screen flex-col items-center bg-zinc-950 px-4 py-8 font-sans text-zinc-100">
      <div className="flex w-full max-w-xl flex-1 flex-col">
        <header className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-lg font-semibold">
            {workspace.name[0]?.toUpperCase()}
          </div>
          <div>
            <h1 className="text-lg font-semibold">{workspace.name} Support</h1>
            <p className="text-sm text-zinc-400">Instant answers, with a real person when you need one</p>
          </div>
        </header>

        <SupportChat
          workspaceSlug={workspace.slug}
          workspaceName={workspace.name}
          suggestions={workspace.slug === "atlas-ring" ? DEMO_SUGGESTIONS : []}
        />

        <p className="mt-4 text-center text-xs text-zinc-500">
          Answers come from our help articles and are written by AI.
          {workspace.slug === "atlas-ring" && " Atlas Ring is a demo brand."}
        </p>
      </div>
    </main>
  );
}
