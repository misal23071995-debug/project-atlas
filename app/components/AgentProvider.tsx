"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Agent } from "@/app/lib/auth/agent";

const AgentContext = createContext<Agent | null>(null);

// Filled in by the root layout from the session, so Client Components can show who is signed in
export function AgentProvider({ agent, children }: { agent: Agent | null; children: ReactNode }) {
  return <AgentContext.Provider value={agent}>{children}</AgentContext.Provider>;
}

export function useAgent() {
  return useContext(AgentContext);
}
