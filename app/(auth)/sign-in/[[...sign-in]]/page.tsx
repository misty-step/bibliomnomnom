import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas-bone px-4">
      <div className="w-full max-w-md">
        <SignIn routing="hash" afterSignInUrl="/library" />
      </div>
    </div>
  );
}
