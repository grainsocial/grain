export class JoinBuilder {
  buildJoins(
    indexedKeys: string[],
    params: Array<string | number | boolean>,
    facetQuery?: { type: string; value: string },
  ): { joinClauses: string; kvAliasMap: Record<string, string> } {
    const kvAliasMap: Record<string, string> = {};
    let joinClauses = "";

    for (let i = 0; i < indexedKeys.length; i++) {
      const key = indexedKeys[i];
      const alias = `kv${i}`;
      kvAliasMap[key] = alias;
      joinClauses += ` LEFT JOIN record_kv AS ${alias} ON ${alias}.uri = record.uri AND ${alias}.key = ?`;
      params.push(key);
    }

    if (facetQuery) {
      joinClauses += ` JOIN facet_index ON record.uri = facet_index.uri`;
    }

    return { joinClauses, kvAliasMap };
  }
}