"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

function SsoLauncher() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Signing you into Ashes Connect…");

  useEffect(() => {
    const ticket = searchParams.get("ticket");
    if (!ticket) {
      window.location.replace("https://www.ashesstack.cloud/connect");
      return;
    }

    let cancelled = false;

    async function run() {
      try {
        const result = await signIn("ashes", {
          ticket,
          redirect: false,
        });

        if (cancelled) return;
        if (result?.error) throw new Error("Ashes sign-in could not be verified");
        window.location.replace("/dashboard");
      } catch {
        if (!cancelled) {
          setMessage("Your Ashes sign-in expired. Sending you back to Ashes…");
          window.setTimeout(() => {
            window.location.replace("https://www.ashesstack.cloud/connect");
          }, 900);
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
      </div>
    </div>
  );
}

export default function SsoPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-black/40">Opening Ashes Connect…</div>}>
      <SsoLauncher />
    </Suspense>
  );
}
