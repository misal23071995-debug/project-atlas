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
