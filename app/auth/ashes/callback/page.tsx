"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

function CallbackLauncher() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Signing you into Ashes Connect…");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      setFailed(true);
      setMessage("This Ashes sign-in link is missing or expired.");
      return;
    }

    let cancelled = false;

    async function run() {
      try {
        const result = await signIn("ashes", {
          code,
          redirect: false,
        });

        if (cancelled) return;
        if (result?.error) throw new Error("Ashes sign-in could not be verified");
        window.location.replace("/dashboard");
      } catch {
        if (!cancelled) {
          setFailed(true);
          setMessage("Ashes verified your account, but Connect could not create its session. The Connect server setup still needs to be completed.");
        }
      }
    }

    run();
    return () => { cancelled = true; };
  }, [searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="card w-full max-w-sm p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-black/40">Ashes account</p>
        <h1 className="mt-3 text-xl font-semibold">Ashes Connect</h1>
        <p className="mt-2 text-sm text-black/60">{message}</p>
        {failed && (
          <a
            className="mt-6 inline-flex rounded-full border border-black/15 px-4 py-2 text-sm font-medium"
            href="https://www.ashesstack.cloud/connect"
          >
            Try again from Ashes
          </a>
        )}
      </div>
    </div>
  );
}

export default function AshesCallbackPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-black/40">Opening Ashes Connect…</div>}>
      <CallbackLauncher />
    </Suspense>
  );
}
