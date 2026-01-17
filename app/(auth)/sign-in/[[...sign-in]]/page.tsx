import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas-bone px-4">
      <div className="w-full max-w-md">
        {/* fallbackRedirectUrl: only used when no redirect_url query param exists.
            This is intentional - allows middleware to redirect back to original page
            when user signs in from a protected route, while defaulting to /library
            for direct sign-in page visits. */}
        <SignIn routing="hash" fallbackRedirectUrl="/library" />
      </div>
    </div>
  );
}
