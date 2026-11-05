import type { Instrumentation } from "next";

// Every server error (pages, server actions, API routes) is saved to the error_events table,
// and emailed to ALERT_EMAIL if that's set. See app/lib/monitoring/errors.ts.
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  // The reporter uses Node APIs, so it only runs in the Node.js runtime
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { recordError } = await import("./app/lib/monitoring/errors");
  const err = error as Error & { digest?: string };
  await recordError({
    message: err?.message ?? String(error),
    digest: err?.digest,
    stack: err?.stack,
    method: request.method,
    path: request.path,
    kind: context.routeType,
    route: context.routePath,
  });
};
