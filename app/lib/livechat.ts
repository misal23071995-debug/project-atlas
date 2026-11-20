// Whether a chat customer is still there. Their chat window checks in every few seconds while it's open.

// The customer counts as "in the chat" if their window checked in this recently
export const ONLINE_SECONDS = 30;

export function chatPresence(lastSeenAt: string | null, leftAt: string | null, now: number) {
  const seen = lastSeenAt ? Date.parse(lastSeenAt) : 0;
  // Ending the chat counts until they open it again
  const left = !!leftAt && Date.parse(leftAt) >= seen;
  return { left, online: !left && now - seen < ONLINE_SECONDS * 1000 };
}
