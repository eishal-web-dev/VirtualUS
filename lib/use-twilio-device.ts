"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Device, Call } from "@twilio/voice-sdk";

export type CallState = "idle" | "connecting" | "ringing" | "connected" | "ended" | "failed";

type IncomingCallInfo = {
  from: string;
  accept: () => void;
  reject: () => void;
};

export function useTwilioDevice() {
  const deviceRef = useRef<Device | null>(null);
  const activeCallRef = useRef<Call | null>(null);

  const [ready, setReady] = useState(false);
  const [callState, setCallState] = useState<CallState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCallInfo | null>(null);
  const [muted, setMuted] = useState(false);

  const fetchToken = useCallback(async () => {
    const res = await fetch("/api/twilio/token", { method: "POST" });
    if (!res.ok) throw new Error("Could not get a voice access token");
    const data = await res.json();
    return data.token as string;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const token = await fetchToken();
        if (cancelled) return;

        const device = new Device(token, {
          logLevel: "error",
        });

        device.on("registered", () => setReady(true));
        device.on("unregistered", () => setReady(false));
        device.on("error", (e) => setError(e.message ?? "Voice device error"));

        device.on("incoming", (call) => {
          setIncomingCall({
            from: call.parameters.From ?? "Unknown",
            accept: () => {
              call.accept();
              activeCallRef.current = call;
              bindCallEvents(call);
              setIncomingCall(null);
            },
            reject: () => {
              call.reject();
              setIncomingCall(null);
            },
          });
        });

        // Refresh the token before Twilio's ~1hr TTL expires.
        device.on("tokenWillExpire", async () => {
          try {
            const newToken = await fetchToken();
            device.updateToken(newToken);
          } catch {
            // best-effort; device will otherwise deregister on expiry
          }
        });

        await device.register();
        deviceRef.current = device;
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not initialize the dialer");
        }
      }
    }

    function bindCallEvents(call: Call) {
      setCallState("connecting");
      call.on("ringing", () => setCallState("ringing"));
      call.on("accept", () => setCallState("connected"));
      call.on("disconnect", () => {
        setCallState("ended");
        activeCallRef.current = null;
        setTimeout(() => setCallState("idle"), 1500);
      });
      call.on("cancel", () => {
        setCallState("ended");
        activeCallRef.current = null;
        setTimeout(() => setCallState("idle"), 1500);
      });
      call.on("error", () => {
        setCallState("failed");
        activeCallRef.current = null;
        setTimeout(() => setCallState("idle"), 2000);
      });
    }

    init();

    return () => {
      cancelled = true;
      deviceRef.current?.destroy();
      deviceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCall = useCallback(async (to: string) => {
    setError(null);
    const device = deviceRef.current;
    if (!device) {
      setError("Dialer is not ready yet");
      return;
    }

    setCallState("connecting");
    try {
      const call = await device.connect({ params: { To: to } });
      activeCallRef.current = call;

      call.on("ringing", () => setCallState("ringing"));
      call.on("accept", () => setCallState("connected"));
      call.on("disconnect", () => {
        setCallState("ended");
        activeCallRef.current = null;
        setTimeout(() => setCallState("idle"), 1500);
      });
      call.on("cancel", () => {
        setCallState("ended");
        activeCallRef.current = null;
        setTimeout(() => setCallState("idle"), 1500);
      });
      call.on("error", (e) => {
        setError(e.message ?? "Call failed");
        setCallState("failed");
        activeCallRef.current = null;
        setTimeout(() => setCallState("idle"), 2000);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not place call");
      setCallState("failed");
      setTimeout(() => setCallState("idle"), 2000);
    }
  }, []);

  const endCall = useCallback(() => {
    activeCallRef.current?.disconnect();
  }, []);

  const toggleMute = useCallback(() => {
    const call = activeCallRef.current;
    if (!call) return;
    const next = !muted;
    call.mute(next);
    setMuted(next);
  }, [muted]);

  const sendDigit = useCallback((digit: string) => {
    activeCallRef.current?.sendDigits(digit);
  }, []);

  return {
    ready,
    callState,
    error,
    incomingCall,
    muted,
    startCall,
    endCall,
    toggleMute,
    sendDigit,
  };
}
