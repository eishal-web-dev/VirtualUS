"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CallState } from "@/lib/use-twilio-device";

type IncomingCallInfo = {
  from: string;
  accept: () => void;
  reject: () => void;
};

type IncomingSession = {
  id: string;
  from: string;
  to: string;
  offer: RTCSessionDescriptionInit;
};

type SessionPayload = {
  id: string;
  status: "RINGING" | "CONNECTED" | "ENDED" | "REJECTED" | "FAILED";
  side: "CALLER" | "CALLEE";
  offer: RTCSessionDescriptionInit;
  answer: RTCSessionDescriptionInit | null;
  candidates: Array<{ id: string; candidate: RTCIceCandidateInit }>;
};

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.cloudflare.com:3478" }];

export function useInAppDevice(enabled: boolean) {
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const sideRef = useRef<"CALLER" | "CALLEE" | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const seenCandidatesRef = useRef(new Set<string>());
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncingRef = useRef(false);
  const incomingSessionRef = useRef<IncomingSession | null>(null);

  const [ready, setReady] = useState(false);
  const [callState, setCallState] = useState<CallState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCallInfo | null>(null);
  const [muted, setMuted] = useState(false);

  const stopSync = useCallback(() => {
    if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    syncTimerRef.current = null;
  }, []);

  const releaseMedia = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    for (const track of localStreamRef.current?.getTracks() ?? []) track.stop();
    localStreamRef.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
    }
    remoteAudioRef.current = null;
  }, []);

  const resetCall = useCallback(
    (state: "ended" | "failed" = "ended") => {
      stopSync();
      sessionIdRef.current = null;
      sideRef.current = null;
      releaseMedia();
      pendingCandidatesRef.current = [];
      seenCandidatesRef.current.clear();
      setMuted(false);
      setIncomingCall(null);
      incomingSessionRef.current = null;
      setCallState(state);
      setTimeout(() => setCallState("idle"), state === "failed" ? 2000 : 1500);
    },
    [releaseMedia, stopSync]
  );

  const patchSession = useCallback(async (id: string, body: Record<string, unknown>) => {
    const response = await fetch(`/api/in-app-calls/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? "Call update failed");
    return data;
  }, []);

  const sendCandidate = useCallback(
    async (candidate: RTCIceCandidateInit) => {
      const id = sessionIdRef.current;
      if (!id) {
        pendingCandidatesRef.current.push(candidate);
        return;
      }
      await patchSession(id, { action: "candidate", candidate });
    },
    [patchSession]
  );

  const createPeer = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("This browser does not support microphone calling");
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = stream;

    const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    for (const track of stream.getTracks()) peer.addTrack(track, stream);
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        void sendCandidate(event.candidate.toJSON()).catch(() => {
          setError("Could not exchange call network details");
        });
      }
    };
    peer.ontrack = (event) => {
      const audio = remoteAudioRef.current ?? new Audio();
      audio.autoplay = true;
      audio.srcObject = event.streams[0] ?? new MediaStream([event.track]);
      remoteAudioRef.current = audio;
      void audio.play().catch(() => {
        setError("Click anywhere once to allow incoming call audio");
      });
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "connected") setCallState("connected");
      if (["failed", "closed"].includes(peer.connectionState) && sessionIdRef.current) {
        resetCall(peer.connectionState === "failed" ? "failed" : "ended");
      }
    };
    peerRef.current = peer;
    return peer;
  }, [resetCall, sendCandidate]);

  const syncSession = useCallback(async () => {
    const id = sessionIdRef.current;
    const peer = peerRef.current;
    if (!id || !peer || syncingRef.current) return;
    syncingRef.current = true;
    try {
      const response = await fetch(`/api/in-app-calls/${id}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not sync the call");
      const session = data.session as SessionPayload;

      if (sideRef.current === "CALLER" && session.answer && !peer.remoteDescription) {
        await peer.setRemoteDescription(session.answer);
      }

      for (const item of session.candidates) {
        if (seenCandidatesRef.current.has(item.id)) continue;
        if (!peer.remoteDescription) continue;
        try {
          await peer.addIceCandidate(item.candidate);
          seenCandidatesRef.current.add(item.id);
        } catch {
          // A candidate may arrive just before the remote description. The
          // next poll retries it; do not end the call.
        }
      }

      if (session.status === "CONNECTED") setCallState("connected");
      if (["ENDED", "REJECTED"].includes(session.status)) resetCall("ended");
      if (session.status === "FAILED") resetCall("failed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Call synchronization failed");
    } finally {
      syncingRef.current = false;
    }
  }, [resetCall]);

  const startSync = useCallback(() => {
    stopSync();
    void syncSession();
    syncTimerRef.current = setInterval(() => void syncSession(), 900);
  }, [stopSync, syncSession]);

  const flushCandidates = useCallback(async () => {
    const queued = pendingCandidatesRef.current.splice(0);
    await Promise.all(queued.map((candidate) => sendCandidate(candidate)));
  }, [sendCandidate]);

  const acceptIncoming = useCallback(async () => {
    const incoming = incomingSessionRef.current;
    if (!incoming) return;
    setError(null);
    setCallState("connecting");
    try {
      sessionIdRef.current = incoming.id;
      sideRef.current = "CALLEE";
      const peer = await createPeer();
      await peer.setRemoteDescription(incoming.offer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await patchSession(incoming.id, { action: "answer", answer: peer.localDescription });
      await flushCandidates();
      setIncomingCall(null);
      setCallState("connected");
      startSync();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not answer the call");
      if (sessionIdRef.current) {
        void patchSession(sessionIdRef.current, { action: "fail" }).catch(() => undefined);
      }
      resetCall("failed");
    }
  }, [createPeer, flushCandidates, patchSession, resetCall, startSync]);

  const rejectIncoming = useCallback(async () => {
    const incoming = incomingSessionRef.current;
    if (!incoming) return;
    setIncomingCall(null);
    incomingSessionRef.current = null;
    await patchSession(incoming.id, { action: "reject" }).catch(() => undefined);
  }, [patchSession]);

  useEffect(() => {
    if (!enabled) {
      setReady(false);
      return;
    }
    setReady(Boolean(globalThis.RTCPeerConnection && navigator.mediaDevices?.getUserMedia));

    async function checkIncoming() {
      if (sessionIdRef.current || incomingSessionRef.current) return;
      try {
        const response = await fetch("/api/in-app-calls", { cache: "no-store" });
        const data = await response.json();
        const incoming = data.incomingCall as IncomingSession | null;
        if (!incoming) return;
        incomingSessionRef.current = incoming;
        setIncomingCall({
          from: incoming.from,
          accept: () => void acceptIncoming(),
          reject: () => void rejectIncoming(),
        });
      } catch {
        // Incoming polling is best effort; the next interval retries.
      }
    }

    void checkIncoming();
    const timer = setInterval(() => void checkIncoming(), 1500);
    return () => {
      clearInterval(timer);
      stopSync();
      const activeSessionId = sessionIdRef.current;
      sessionIdRef.current = null;
      sideRef.current = null;
      if (activeSessionId) {
        void patchSession(activeSessionId, { action: "end" }).catch(() => undefined);
      }
      releaseMedia();
    };
  }, [acceptIncoming, enabled, patchSession, rejectIncoming, releaseMedia, stopSync]);

  const startCall = useCallback(
    async (to: string) => {
      setError(null);
      setCallState("connecting");
      pendingCandidatesRef.current = [];
      seenCandidatesRef.current.clear();
      sideRef.current = "CALLER";
      try {
        const peer = await createPeer();
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        const response = await fetch("/api/in-app-calls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to, offer: peer.localDescription }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not start the call");
        sessionIdRef.current = data.session.id;
        await flushCandidates();
        setCallState("ringing");
        startSync();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not start the call");
        resetCall("failed");
      }
    },
    [createPeer, flushCandidates, resetCall, startSync]
  );

  const endCall = useCallback(() => {
    const id = sessionIdRef.current;
    if (id) void patchSession(id, { action: "end" }).catch(() => undefined);
    resetCall("ended");
  }, [patchSession, resetCall]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    for (const track of localStreamRef.current?.getAudioTracks() ?? []) track.enabled = !next;
    setMuted(next);
  }, [muted]);

  const sendDigit = useCallback((_digit: string) => {
    // DTMF is a public telephone-network feature and is intentionally absent
    // from free Ashes-to-Ashes WebRTC calls.
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
