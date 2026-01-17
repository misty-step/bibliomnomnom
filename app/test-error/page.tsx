"use client";

import { captureError, captureMessage } from "@/lib/sentry";

/**
 * Test page to verify Sentry error reporting is working.
 * Only accessible in development mode.
 */
export default function TestErrorPage() {
  const throwError = () => {
    throw new Error("Test error from client: user@example.com clicked the button");
  };

  const captureException = () => {
    try {
      throw new Error("Captured exception test with email test@example.com");
    } catch (e) {
      captureError(e, { tags: { test: "manual-capture" } });
      alert("Exception captured and sent to Sentry");
    }
  };

  const sendMessage = () => {
    captureMessage("Test message from Sentry verification page", "info", {
      tags: { test: "message" },
    });
    alert("Message sent to Sentry");
  };

  if (process.env.NODE_ENV === "production") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-ink">This page is only available in development.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="font-display text-2xl text-ink">Sentry Test Page</h1>
      <p className="text-inkMuted max-w-md text-center">
        Use these buttons to verify Sentry error tracking is working correctly. Check your Sentry
        dashboard for incoming errors.
      </p>

      <div className="flex flex-col gap-4">
        <button
          onClick={throwError}
          className="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700"
        >
          Throw Unhandled Error
        </button>

        <button
          onClick={captureException}
          className="rounded-md bg-orange-600 px-4 py-2 text-white hover:bg-orange-700"
        >
          Capture Exception (Handled)
        </button>

        <button
          onClick={sendMessage}
          className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Send Test Message
        </button>
      </div>

      <p className="text-sm text-inkMuted mt-4">
        Note: Email addresses in errors should be redacted to [EMAIL_REDACTED]
      </p>
    </div>
  );
}
