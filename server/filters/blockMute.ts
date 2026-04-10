/**
 * Returns a SQL fragment that excludes rows from blocked (bidirectional) and muted users.
 * @param didColumn - the column containing the actor's DID (e.g. "t.did")
 * @param viewerParam - the SQL parameter number for the viewer DID (e.g. "$1")
 */
export function blockMuteFilter(didColumn: string, viewerParam: string): string {
  return `
    ${didColumn} NOT IN (
      SELECT subject FROM "social.grain.graph.block" WHERE did = ${viewerParam}
    )
    AND ${didColumn} NOT IN (
      SELECT did FROM "social.grain.graph.block" WHERE subject = ${viewerParam}
    )
    AND ${didColumn} NOT IN (
      SELECT subject FROM _mutes WHERE did = ${viewerParam}
    )
  `;
}

/**
 * Returns a SQL fragment that excludes rows from blocked users only (bidirectional).
 * Use this when muted content should still be returned (e.g. comments with a muted flag).
 */
export function blockFilter(didColumn: string, viewerParam: string): string {
  return `
    ${didColumn} NOT IN (
      SELECT subject FROM "social.grain.graph.block" WHERE did = ${viewerParam}
    )
    AND ${didColumn} NOT IN (
      SELECT did FROM "social.grain.graph.block" WHERE subject = ${viewerParam}
    )
  `;
}
