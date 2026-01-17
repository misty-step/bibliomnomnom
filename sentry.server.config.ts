import * as Sentry from "@sentry/nextjs";
import { baseConfig } from "./lib/sentry-config";

Sentry.init(baseConfig);
