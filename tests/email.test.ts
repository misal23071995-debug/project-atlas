import { describe, expect, it } from "vitest";
import { htmlToText, normalizeInbound, parseAddress, stripQuotedReply, subjectWithRef, ticketRef } from "@/app/lib/email/parse";

describe("email parsing", () => {
  it("reads addresses", () => {
    expect(parseAddress('"Priya S" <Priya@Example.com>')).toEqual({ email: "priya@example.com", name: "Priya S" });
    expect(parseAddress("a@b.co")).toEqual({ email: "a@b.co", name: "" });
  });

  it("finds and writes the ticket tag in subjects", () => {
    expect(ticketRef("Re: Ring not syncing [#5003]")).toBe("5003");
    expect(ticketRef("Ring #5003")).toBeNull();
    expect(subjectWithRef("Re: RE: Fwd: Ring [#5003]", "5003")).toBe("Re: Ring [#5003]");
    expect(subjectWithRef("Ring not syncing", "5010")).toBe("Re: Ring not syncing [#5010]");
  });

  it("keeps only the new part of a reply", () => {
    expect(stripQuotedReply("Thanks, works now!\n\nOn Mon, 3 Nov 2026 at 10:00, Atlas <s@x.com> wrote:\n> old")).toBe("Thanks, works now!");
    expect(stripQuotedReply("Still broken.\n\nFrom: Atlas Support\nSent: Monday")).toBe("Still broken.");
    expect(stripQuotedReply("From: my other phone\nhello")).toBe("From: my other phone\nhello");
  });

  it("turns HTML into text", () => {
    expect(htmlToText("<p>Hi&nbsp;there</p><p>Line 2<br>3</p>")).toBe("Hi there\nLine 2\n3");
  });

  it("reads Postmark's webhook and the simple JSON shape", () => {
    expect(
      normalizeInbound({
        FromFull: { Email: "Aanya@Example.com", Name: "Aanya Rao" },
        Subject: "Re: Sync [#5003]",
        TextBody: "Works now\n\nOn Tue wrote:\n> x",
        Headers: [{ Name: "Message-ID", Value: "<m1@mail>" }, { Name: "In-Reply-To", Value: "<a@b>" }],
      })
    ).toEqual({ fromEmail: "aanya@example.com", fromName: "Aanya Rao", subject: "Re: Sync [#5003]", text: "Works now", messageId: "<m1@mail>", replyTo: ["<a@b>"], attachments: [] });
    expect(normalizeInbound({ from: "Rohan <rohan@example.com>", subject: "Hi", text: "Help" })?.fromName).toBe("Rohan");
  });

  it("reads attachments from both shapes, skipping empty ones", () => {
    const postmark = normalizeInbound({
      FromFull: { Email: "a@b.co" },
      TextBody: "See photo",
      Attachments: [
        { Name: "crack.jpg", ContentType: "image/jpeg; name=crack.jpg", Content: "aGVsbG8=" },
        { Name: "", ContentType: "image/png", Content: "eA==" },
      ],
    });
    expect(postmark?.attachments).toEqual([{ name: "crack.jpg", contentType: "image/jpeg", base64: "aGVsbG8=" }]);
    const simple = normalizeInbound({ from: "a@b.co", text: "x", attachments: [{ filename: "a.pdf", contentType: "application/pdf", content: "eA==" }] });
    expect(simple?.attachments).toEqual([{ name: "a.pdf", contentType: "application/pdf", base64: "eA==" }]);
  });

  it("rejects mail without a sender or any text", () => {
    expect(normalizeInbound({ from: "not an email", text: "x" })).toBeNull();
    expect(normalizeInbound({ from: "a@b.co", subject: "", text: "" })).toBeNull();
    expect(normalizeInbound({ from: "a@b.co", subject: "Refund please", text: "" })?.text).toBe("Refund please");
  });
});
