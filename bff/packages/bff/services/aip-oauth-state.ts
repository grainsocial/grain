import type { Database } from "../types.d.ts";

export interface AipOAuthStateTable {
  state: string;
  codeVerifier: string;
  returnUrl: string;
  createdAt: number;
  expiresAt: number;
}

export class AipOAuthStateStore {
  private getStmt;
  private setStmt;
  private deleteStmt;
  private cleanupStmt;

  constructor(db: Database) {
    // Prepare statements for better performance
    this.getStmt = db.prepare(
      `SELECT code_verifier, return_url, created_at, expires_at 
       FROM aip_oauth_state 
       WHERE state = ? AND expires_at > ?`
    );
    
    this.setStmt = db.prepare(
      `INSERT INTO aip_oauth_state (state, code_verifier, return_url, created_at, expires_at) 
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (state) DO UPDATE SET
         code_verifier = excluded.code_verifier,
         return_url = excluded.return_url,
         created_at = excluded.created_at,
         expires_at = excluded.expires_at`
    );
    
    this.deleteStmt = db.prepare(`DELETE FROM aip_oauth_state WHERE state = ?`);
    this.cleanupStmt = db.prepare(`DELETE FROM aip_oauth_state WHERE expires_at <= ?`);
  }

  get(state: string): AipOAuthStateTable | null {
    const now = Date.now();
    const result = this.getStmt.get(state, now) as {
      code_verifier: string;
      return_url: string;
      created_at: number;
      expires_at: number;
    } | undefined;

    if (!result) return null;

    return {
      state,
      codeVerifier: result.code_verifier,
      returnUrl: result.return_url,
      createdAt: result.created_at,
      expiresAt: result.expires_at,
    };
  }

  set(oauthState: AipOAuthStateTable): void {
    this.setStmt.run(
      oauthState.state,
      oauthState.codeVerifier,
      oauthState.returnUrl,
      oauthState.createdAt,
      oauthState.expiresAt,
    );
  }

  delete(state: string): void {
    this.deleteStmt.run(state);
  }

  cleanupExpired(): number {
    const now = Date.now();
    const result = this.cleanupStmt.run(now);
    return Number(result.changes ?? 0);
  }

  create(
    state: string,
    codeVerifier: string,
    returnUrl: string,
    expiresInSeconds: number = 600, // 10 minutes default
  ): void {
    const now = Date.now();
    const expiresAt = now + (expiresInSeconds * 1000);

    const oauthState: AipOAuthStateTable = {
      state,
      codeVerifier,
      returnUrl,
      createdAt: now,
      expiresAt,
    };

    this.set(oauthState);
  }
}