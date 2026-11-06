import { describe, expect, it } from "vitest";
import { checkFile, formatBytes, isImage, safeFileName } from "@/app/lib/attachments";

describe("attachments", () => {
  it("allows common files up to 10 MB and refuses risky or huge ones", () => {
    expect(checkFile("a.png", "image/png", 1000)).toBeNull();
    expect(checkFile("a.pdf", "application/pdf", 10 * 1024 * 1024)).toBeNull();
    expect(checkFile("a.pdf", "application/pdf", 10 * 1024 * 1024 + 1)).toMatch(/over 10 MB/);
    expect(checkFile("x.svg", "image/svg+xml", 100)).toMatch(/can't be attached/);
    expect(checkFile("x.html", "text/html", 100)).toMatch(/can't be attached/);
    expect(checkFile("empty.txt", "text/plain", 0)).toMatch(/empty/);
  });

  it("makes file names safe for storage and downloads", () => {
    expect(safeFileName("../../etc/passwd")).toBe("etcpasswd");
    expect(safeFileName("My screenshot (1).png")).toBe("My-screenshot-1.png");
    expect(safeFileName("<script>.png")).toBe("script.png");
    expect(safeFileName("???")).toBe("file");
  });

  it("shows sizes and knows which files are images", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3.5 * 1024 * 1024)).toBe("3.5 MB");
    expect(isImage("image/png")).toBe(true);
    expect(isImage("image/heic")).toBe(false);
    expect(isImage("application/pdf")).toBe(false);
  });
});
