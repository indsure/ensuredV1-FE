/**
 * Session Store - In-memory storage for extracted policies
 * Auto-deletes after 24 hours for DPDP compliance
 */

import type { ExtractedPolicy } from '../types/policy';

interface Session {
  id: string;
  policies: ExtractedPolicy[];
  createdAt: number;
  expiresAt: number;
}

class SessionStore {
  private sessions: Map<string, Session> = new Map();
  private cleanupInterval: NodeJS.Timeout;
  
  constructor() {
    // Cleanup expired sessions every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000);
  }
  
  create(sessionId: string, policies: ExtractedPolicy[]): void {
    const now = Date.now();
    const expiresAt = now + (24 * 60 * 60 * 1000); // 24 hours
    
    this.sessions.set(sessionId, {
      id: sessionId,
      policies,
      createdAt: now,
      expiresAt,
    });
    
    console.log(`Session created: ${sessionId}, expires at ${new Date(expiresAt).toISOString()}`);
  }
  
  get(sessionId: string): ExtractedPolicy[] | null {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return null;
    }
    
    // Check if expired
    if (Date.now() > session.expiresAt) {
      this.delete(sessionId);
      return null;
    }
    
    return session.policies;
  }
  
  delete(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    
    if (deleted) {
      console.log(`Session deleted: ${sessionId}`);
      
      // Audit log (no PII)
      this.logDeletion(sessionId);
    }
    
    return deleted;
  }
  
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.delete(sessionId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} expired sessions`);
    }
  }
  
  private logDeletion(sessionId: string): void {
    // In production, write to audit log (timestamp + session ID only, no PII)
    const auditEntry = {
      timestamp: new Date().toISOString(),
      sessionId,
      action: 'deleted',
    };
    
    // For now, just console log
    console.log('AUDIT:', JSON.stringify(auditEntry));
  }
  
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.sessions.clear();
  }
}

export const sessionStore = new SessionStore();
