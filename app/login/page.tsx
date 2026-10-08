import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const instant = false;

async function LoginGate() {
  const session = await auth();
  if (session?.user) redirect("/");
  return <LoginForm />;
}

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-neutral-500">ReactPress admin login</p>
      </div>
      <Suspense fallback={<p className="text-sm text-neutral-500">Loading…</p>}>
        <LoginGate />
      </Suspense>
    </main>
  );
}
