"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/card";
import { useTwilioDevice } from "@/lib/use-twilio-device";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

export function Dialer() {
  const [ownedNumber, setOwnedNumber] = useState<string | null | undefined>(undefined);
  const [destination, setDestination] = useState("");
  const [seconds, setSeconds] = useState(0);

  const {
    ready,
    callState,
    error,
    incomingCall,
    muted,
    startCall,
    endCall,
    toggleMute,
    sendDigit,
  } = useTwilioDevice();

  useEffect(() => {
    fetch("/api/numbers/me")
      .then((r) => r.json())
      .then((data) => setOwnedNumber(data.phoneNumber?.number ?? null))
      .catch(() => setOwnedNumber(null));
  }, []);

  useEffect(() => {
    if (callState !== "connected") {
      setSeconds(0);
      return;
    }
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [callState]);

  function handleKeyPress(key: string) {
    setDestination((d) => d + key);
    if (callState === "connected") sendDigit(key);
  }

  function handleCall() {
    if (!destination) return;
    const normalized = destination.startsWith("+") ? destination : `+1${destination.replace(/\D/g, "")}`;
    startCall(normalized);
  }

  const isInCall = ["connecting", "ringing", "connected"].includes(callState);

  if (ownedNumber === undefined) {
    return <p className="text-sm text-black/40">Loading…</p>;
  }

  if (ownedNumber === null) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Dialer</h1>
        <Card className="p-8 text-center">
          <p className="text-black/60">You need a US number before you can make calls.</p>
          <a href="/dashboard/numbers" className="mt-4 inline-block">
            <Button>Get a number</Button>
          </a>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dialer</h1>
          <p className="mt-1 text-sm text-black/60">Calling from {ownedNumber}</p>
        </div>
        <Badge tone={ready ? "green" : "yellow"}>{ready ? "Ready" : "Connecting device…"}</Badge>
      </div>

      {incomingCall && (
        <Card className="flex items-center justify-between border-blue-100 bg-blue-50 p-5">
          <div>
            <p className="text-sm text-blue-700">Incoming call</p>
            <p className="text-lg font-semibold">{incomingCall.from}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="danger" onClick={incomingCall.reject}>
              Reject
            </Button>
            <Button onClick={incomingCall.accept}>Answer</Button>
          </div>
        </Card>
      )}

      <Card className="mx-auto max-w-sm p-6 shadow-glow">
        <Input
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="+1 312 555 0100"
          disabled={isInCall}
          className="text-center text-lg tracking-wide"
        />

        <div className="mt-5 grid grid-cols-3 gap-3">
          {KEYS.map((key) => (
            <button
              key={key}
              onClick={() => handleKeyPress(key)}
              className="aspect-square rounded-xl border border-black/[.08] bg-white text-xl font-medium text-ink transition-all duration-150 hover:scale-[1.03] hover:border-brand-200 hover:bg-brand-50 active:scale-95"
            >
              {key}
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-col items-center gap-3">
          <CallStatusLine callState={callState} seconds={seconds} />

          {error && <p className="text-sm text-red-600">{error}</p>}

          {isInCall ? (
            <div className="flex w-full gap-3">
              <Button variant="secondary" onClick={toggleMute} className="flex-1">
                {muted ? "Unmute" : "Mute"}
              </Button>
              <Button variant="danger" onClick={endCall} className="flex-1">
                End Call
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleCall}
              disabled={!ready || !destination}
              variant="gradient"
              className="w-full"
              size="lg"
            >
              Call
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function CallStatusLine({ callState, seconds }: { callState: string; seconds: number }) {
  if (callState === "idle") return null;

  const labels: Record<string, string> = {
    connecting: "Connecting…",
    ringing: "Ringing…",
    connected: `Connected · ${formatTimer(seconds)}`,
    ended: "Call ended",
    failed: "Call failed",
  };

  const tones: Record<string, "neutral" | "green" | "yellow" | "red" | "blue"> = {
    connecting: "blue",
    ringing: "blue",
    connected: "green",
    ended: "neutral",
    failed: "red",
  };

  const pulsing = callState === "connecting" || callState === "ringing";

  return (
    <Badge tone={tones[callState] ?? "neutral"} className={pulsing ? "animate-pulse-soft" : "animate-fade-in"}>
      {labels[callState] ?? callState}
    </Badge>
  );
}

function formatTimer(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
