import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas-bone px-4">
      <div className="w-full max-w-md">
        <SignUp routing="hash" afterSignUpUrl="/library" />
      </div>
    </div>
  );
}
