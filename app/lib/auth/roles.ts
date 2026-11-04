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
  lead: "Works tickets, edits the knowledge base, builds the roster and approves leave",
  agent: "Replies to and updates tickets",
  qa: "Scores conversations for quality and leaves internal notes",
};

const PERMISSIONS = {
  // Reply, change status or priority, assign, log new tickets
  "tickets.work": ["admin", "lead", "agent"],
  "tickets.note": ["admin", "lead", "agent", "qa"],
  "knowledge.edit": ["admin", "lead"],
  // Write the saved replies agents insert into tickets. Everyone who works tickets can use them.
  "replies.manage": ["admin", "lead"],
  // Email settings and the test inbox; changing the incoming address is for admins (workspace.manage)
  "email.manage": ["admin", "lead"],
  // Score conversations and see everyone's quality results. Agents only see their own.
  "quality.review": ["admin", "lead", "qa"],
  "quality.scorecard": ["admin", "lead"],
  // Build the roster and approve leave. Everyone can see the roster and request leave.
  "roster.manage": ["admin", "lead"],
  "capacity.manage": ["admin", "lead"],
  // Set the reply and resolution targets for each priority. Everyone sees the SLA clocks.
  "sla.manage": ["admin", "lead"],
  // Team-wide reports, including how each agent is doing
  "reports.view": ["admin", "lead", "qa"],
  // Write courses, assign them and see everyone's results. Everyone can take training.
  "training.manage": ["admin", "lead", "qa"],
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
