import type { Database } from "../types.d.ts";

export interface AipSessionTable {
  sessionId: string;
  did: string;
  handle: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export class AipSessionStore {
  private db: Database;
  private getStmt;
  private setStmt;
  private deleteStmt;
  private cleanupStmt;

  constructor(db: Database) {
    this.db = db;
    
    // Create table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS "aip_session" (
        "session_id" TEXT PRIMARY KEY NOT NULL,
        "did" TEXT NOT NULL,
        "handle" TEXT NOT NULL,
        "access_token" TEXT NOT NULL,
        "refresh_token" TEXT NOT NULL,
        "expires_at" INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS "idx_aip_session_expires_at" ON "aip_session" ("expires_at");
    `);

    // Prepare statements for better performance
    this.getStmt = db.prepare(
      `SELECT did, handle, access_token, refresh_token, expires_at 
       FROM aip_session 
       WHERE session_id = ?`
    );
    
    this.setStmt = db.prepare(
      `INSERT INTO aip_session (session_id, did, handle, access_token, refresh_token, expires_at) 
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (session_id) DO UPDATE SET
         did = excluded.did,
         handle = excluded.handle,
         access_token = excluded.access_token,
         refresh_token = excluded.refresh_token,
         expires_at = excluded.expires_at`
    );
    
    this.deleteStmt = db.prepare(`DELETE FROM aip_session WHERE session_id = ?`);
    this.cleanupStmt = db.prepare(`DELETE FROM aip_session WHERE expires_at <= ?`);
  }

  get(sessionId: string): AipSessionTable | null {
    const result = this.getStmt.get(sessionId) as {
      did: string;
      handle: string;
      access_token: string;
      refresh_token: string;
      expires_at: number;
    } | undefined;

    if (!result) return null;

    return {
      sessionId,
      did: result.did,
      handle: result.handle,
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
      expiresAt: result.expires_at,
    };
  }

  set(session: AipSessionTable): void {
    this.setStmt.run(
      session.sessionId,
      session.did,
      session.handle,
      session.accessToken,
      session.refreshToken,
      session.expiresAt,
    );
  }

  delete(sessionId: string): void {
    this.deleteStmt.run(sessionId);
  }

  cleanupExpired(): number {
    // Clean up sessions that are expired beyond refresh token validity
    // Assuming refresh tokens are valid longer than access tokens
    const now = Date.now();
    const result = this.cleanupStmt.run(now);
    return Number(result.changes ?? 0);
  }

  createSession(
    did: string,
    handle: string,
    accessToken: string,
    refreshToken: string,
    expiresIn: number = 86400,
  ): string {
    const sessionId = crypto.randomUUID();
    const expiresAt = Date.now() + (expiresIn * 1000);

    const session: AipSessionTable = {
      sessionId,
      did,
      handle,
      accessToken,
      refreshToken,
      expiresAt,
    };

    this.set(session);
    return sessionId;
  }

  // Update session with new tokens after refresh
  updateTokens(
    sessionId: string,
    accessToken: string,
    refreshToken: string,
    expiresIn: number,
  ): void {
    const session = this.get(sessionId);
    if (!session) return;

    session.accessToken = accessToken;
    session.refreshToken = refreshToken;
    session.expiresAt = Date.now() + (expiresIn * 1000);

    this.set(session);
  }
}