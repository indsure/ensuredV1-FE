import { useState, useRef, useCallback } from 'react';
import { getApiBase } from "@/lib/queryClient";

type SessionStatus =
  | 'IDLE' | 'NAVIGATING' | 'AWAITING_LOGIN'
  | 'LOGIN_SUCCESS' | 'TRIGGERING_DOWNLOAD'
  | 'DOWNLOAD_COMPLETE' | 'LOGIN_TIMEOUT' | 'ERROR';

export function usePolicySession() {
  const [status, setStatus] = useState<SessionStatus>('IDLE');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const startSession = useCallback(async (insurerKey: string) => {
    setStatus('NAVIGATING');

    const apiBase = getApiBase().replace(/\/+$/, "");
    const httpBase = apiBase || "";
    const startUrl = httpBase ? `${httpBase}/api/policy/start-session` : "/api/policy/start-session";

    const res = await fetch(startUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ insurerKey }),
    });
    const { sessionId } = await res.json();
    setSessionId(sessionId);

    // Open WebSocket to receive live status
    const wsBase =
      httpBase
        ? httpBase.replace(/^https:/, "wss:").replace(/^http:/, "ws:")
        : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;

    const ws = new WebSocket(`${wsBase}/ws/policy-session?sessionId=${sessionId}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const { status: s, data } = JSON.parse(event.data);
      setStatus(s);
      if (s === 'DOWNLOAD_COMPLETE') {
        setFilename(data?.filename ?? 'policy.pdf');
      }
    };
  }, []);

  const downloadFile = useCallback(() => {
    if (!sessionId) return;
    const apiBase = getApiBase().replace(/\/+$/, "");
    const httpBase = apiBase || "";
    const downloadUrl = httpBase ? `${httpBase}/api/policy/download/${sessionId}` : `/api/policy/download/${sessionId}`;
    window.open(downloadUrl, '_blank');
  }, [sessionId]);

  return { status, sessionId, filename, startSession, downloadFile };
}

