import type { User } from "@supabase/supabase-js";

// The signed-in support agent. Safe to pass to Client Components.
export interface Agent {
  id: string;

  email: string;

  name: string;
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

// "priya.sharma@acme.com" -> "Priya Sharma"
function nameFromEmail(email: string) {
  return email
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

// A display name from the account's metadata (full_name or name), else from the email
export function toAgent(user: User): Agent {
  const email = user.email ?? "";
  const metadataName = user.user_metadata?.full_name ?? user.user_metadata?.name;
  const name =
    typeof metadataName === "string" && metadataName.trim()
      ? metadataName.trim()
      : nameFromEmail(email) || "Agent";

  return { id: user.id, email, name };
}
