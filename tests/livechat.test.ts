import { describe, expect, it } from "vitest";
import { chatPresence } from "@/app/lib/livechat";

const now = Date.parse("2026-11-20T10:00:00Z");

describe("chatPresence", () => {
  it("is online when the chat window checked in a few seconds ago", () => {
    expect(chatPresence("2026-11-20T09:59:55Z", null, now)).toEqual({ online: true, left: false });
  });

  it("is away when the window hasn't checked in for a while", () => {
    expect(chatPresence("2026-11-20T09:58:00Z", null, now)).toEqual({ online: false, left: false });
  });

  it("is away when the customer has never opened the live chat", () => {
    expect(chatPresence(null, null, now).online).toBe(false);
  });

  it("counts End chat as left, even with a recent check-in before it", () => {
    expect(chatPresence("2026-11-20T09:59:55Z", "2026-11-20T09:59:58Z", now)).toEqual({ online: false, left: true });
  });

  it("is back online if the customer reopens the chat after ending it", () => {
    expect(chatPresence("2026-11-20T09:59:59Z", "2026-11-20T09:59:30Z", now)).toEqual({ online: true, left: false });
  });
});
