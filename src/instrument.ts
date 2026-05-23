import * as Sentry from "@sentry/node";
import { isSentryEnabled } from "./lib/sentryEnabled.js";

if (isSentryEnabled) {
  Sentry.init({
    dsn:
      process.env.SENTRY_DSN ??
      "https://8044ceb5ed57515b12c739acbefa0595@o4511167320817664.ingest.us.sentry.io/4511167510347776",
    sendDefaultPii: true,
  });
}
