import { Router, Request, Response } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { runPolicyDownloadSession } from '../services/playwright-session';
import { v4 as uuid } from 'uuid';
import * as path from 'path';

export const policyFetchRouter = Router();

// REST: kick off a session, returns sessionId
policyFetchRouter.post('/start-session', (req: Request, res: Response) => {
  const { insurerKey } = req.body;
  if (!insurerKey) return res.status(400).json({ error: 'insurerKey required' });

  const sessionId = uuid();
  res.json({ sessionId });

  // Session runs independently after response
  // Status updates go via WebSocket (see attachWSS below)
  activeSessions.set(sessionId, { insurerKey, status: 'PENDING' });
});

// Download the saved PDF
policyFetchRouter.get('/download/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = activeSessions.get(sessionId);
  if (!session?.filePath) return res.status(404).json({ error: 'File not ready' });
  res.download(session.filePath);
});

// In-memory session store (use Redis in prod)
export const activeSessions = new Map<string, any>();

export function attachWSS(wss: WebSocketServer) {
  wss.on('connection', (ws: WebSocket, req) => {
    const sessionId = new URL(req.url!, 'http://localhost').searchParams.get('sessionId');
    if (!sessionId) return ws.close();

    const session = activeSessions.get(sessionId);
    if (!session) return ws.close();

    const { insurerKey } = session;

    runPolicyDownloadSession(insurerKey, sessionId, (status, data) => {
      ws.send(JSON.stringify({ status, data }));
      activeSessions.set(sessionId, { ...activeSessions.get(sessionId), status });
      if (status === 'DOWNLOAD_COMPLETE' && data?.savePath) {
        activeSessions.set(sessionId, {
          ...activeSessions.get(sessionId),
          filePath: data.savePath,
          filename: data.filename,
        });
      }
    });
  });
}

