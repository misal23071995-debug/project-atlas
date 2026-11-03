import type { Metadata } from "next";
import SupportChat from "./SupportChat";

export const metadata: Metadata = {
  title: "Atlas Ring Support",
  description: "Get help with your Atlas Ring from our support assistant.",
};

// Public page for customers: no sign-in needed (see proxy.ts)
export default function SupportPage() {
  return (
    <main className="flex min-h-screen flex-col items-center bg-zinc-950 px-4 py-8 font-sans text-zinc-100">
      <div className="flex w-full max-w-xl flex-1 flex-col">
        <header className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-lg">
            💍
          </div>
          <div>
            <h1 className="text-lg font-semibold">Atlas Ring Support</h1>
            <p className="text-sm text-zinc-400">Instant answers, with a real person when you need one</p>
          </div>
        </header>

        <SupportChat />

        <p className="mt-4 text-center text-xs text-zinc-500">
          Answers come from our help articles and are written by AI. Atlas Ring is a demo brand.
        </p>
      </div>
    </main>
  );
}
