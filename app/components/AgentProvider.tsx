"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Agent } from "@/app/lib/auth/agent";
import { can, type Permission, type Session } from "@/app/lib/auth/roles";

const SessionContext = createContext<Session | null>(null);

// Filled in by the root layout, so Client Components can show who is signed in,
// which workspace they're in, and hide controls their role can't use.
// Server Actions check the role again; hiding a button is only for a tidy screen.
export function AgentProvider({ session, children }: { session: Session | null; children: ReactNode }) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}

export function useAgent(): Agent | null {
  return useContext(SessionContext)?.agent ?? null;
}

export function useCan(permission: Permission) {
  const session = useContext(SessionContext);
  return session ? can(session.role, permission) : false;
}
