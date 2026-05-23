/** Sentry runs only when NODE_ENV is production (e.g. deployed API). */
export const isSentryEnabled = process.env.NODE_ENV === "production";
