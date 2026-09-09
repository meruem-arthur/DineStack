// Reports an error caught by the root error boundary.
// Currently just logs to the console — wire up a real error-tracking service
// (Sentry, LogRocket, etc.) here later if you want alerts/history for
// production errors.

export function reportRuntimeError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;

  // Loaders and server fns commonly throw a raw Response; String(it) is the
  // opaque "[object Response]", so pull out the status and URL instead.
  const message =
    error instanceof Response
      ? `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`
      : error instanceof Error
        ? error.message
        : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  console.error("[error-boundary]", message, {
    route: window.location.pathname,
    ...context,
    ...(stack !== undefined && { stack }),
  });
}
