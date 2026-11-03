// Roles inside a workspace and what each one may do. Safe to import from Client Components.

import type { Agent } from "./agent";

export const ROLES = ["admin", "lead", "agent", "qa"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  lead: "Team Lead",
  agent: "Agent",
  qa: "QA Analyst",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "Everything, including the team and workspace settings",
  lead: "Works tickets and edits the knowledge base",
  agent: "Replies to and updates tickets",
  qa: "Scores conversations for quality and leaves internal notes",
};

const PERMISSIONS = {
  // Reply, change status or priority, assign, log new tickets
  "tickets.work": ["admin", "lead", "agent"],
  "tickets.note": ["admin", "lead", "agent", "qa"],
  "knowledge.edit": ["admin", "lead"],
  // Score conversations and see everyone's quality results. Agents only see their own.
  "quality.review": ["admin", "lead", "qa"],
  "quality.scorecard": ["admin", "lead"],
  "team.manage": ["admin"],
  "workspace.manage": ["admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission) {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export function isRole(value: unknown): value is Role {
  return ROLES.includes(value as Role);
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
}

// Who is signed in, which workspace they're working in, and their role there
export interface Session {
  agent: Agent;
  org: Workspace;
  role: Role;
  // Every workspace this person belongs to, for the switcher
  workspaces: (Workspace & { role: Role })[];
}
