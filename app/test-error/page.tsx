import { notFound } from "next/navigation";
import { TestErrorClient } from "./TestErrorClient";

/**
 * Test page to verify Sentry error reporting is working.
 * Server-side blocked in production - route returns 404.
 */
export default function TestErrorPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <TestErrorClient />;
}
