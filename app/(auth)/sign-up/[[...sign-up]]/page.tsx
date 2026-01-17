import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas-bone px-4">
      <div className="w-full max-w-md">
        {/* fallbackRedirectUrl: only used when no redirect_url query param exists.
            This is intentional - allows middleware to redirect back to original page
            when user signs up from a protected route, while defaulting to /library
            for direct sign-up page visits. */}
        <SignUp routing="hash" fallbackRedirectUrl="/library" />
      </div>
    </div>
  );
}
