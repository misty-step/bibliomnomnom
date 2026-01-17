import * as Sentry from "@sentry/nextjs";
import { baseConfig } from "./lib/sentry-config";

Sentry.init({
  ...baseConfig,

  // Session replay for debugging UI issues (1% of sessions, 100% on error)
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});
