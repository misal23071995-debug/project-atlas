import path from "node:path";
import { defineConfig } from "vitest/config";

// Tests for the logic that doesn't need a database or a browser: SLA clocks, reports, email parsing,
// automation rules, orders, staffing maths. Run with `npm test`.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      // Server-only modules refuse to load outside Next; the tested code never touches the server
      "server-only": path.resolve(__dirname, "tests/server-only-stub.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
