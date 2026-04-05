import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: "https://8044ceb5ed57515b12c739acbefa0595@o4511167320817664.ingest.us.sentry.io/4511167510347776",
  sendDefaultPii: true,
});
