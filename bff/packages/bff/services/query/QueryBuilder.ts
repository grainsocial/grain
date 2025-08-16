import type { Where, WhereCondition } from "../../types.d.ts";

export class QueryBuilder {
  constructor(
    private tableColumns: string[],
    private indexedKeys: Set<string>,
    private kvAliasMap: Record<string, string>,
  ) {}

  buildWhereClause(
    condition: Where | Where[],
    params: Array<string | number | boolean>,
  ): string {
    if (Array.isArray(condition)) {
      return condition.map((c) =>
        this.buildWhereClause(c, params)
      ).join(" AND ");
    }
    if ("AND" in condition) {
      const parts = condition.AND!.map((c) =>
        `(${this.buildWhereClause(c, params)})`
      );
      return parts.join(" AND ");
    }
    if ("OR" in condition) {
      const parts = condition.OR!.map((c) =>
        `(${this.buildWhereClause(c, params)})`
      );
      return parts.join(" OR ");
    }
    if ("NOT" in condition) {
      return `NOT (${this.buildWhereClause(condition.NOT!, params)})`;
    }
    const { field, equals, contains, in: inArray } = condition as WhereCondition;
    if (!field) throw new Error("Missing 'field' in condition");
    const columnExpr = this.getColumnExpression(field);
    if (equals !== undefined) {
      params.push(equals);
      return `${columnExpr} = ?`;
    }
    if (inArray) {
      const placeholders = inArray.map(() => "?").join(", ");
      params.push(...inArray);
      return `${columnExpr} IN (${placeholders})`;
    }
    if (contains !== undefined) {
      params.push(`%${contains}%`);
      return `${columnExpr} LIKE ?`;
    }
    throw new Error("Unsupported condition format");
  }

  private getColumnExpression(field: string): string {
    const isDirect = this.tableColumns.includes(field);
    const isIndexed = this.indexedKeys.has(field);
    if (isDirect) {
      return `record.${field}`;
    } else if (isIndexed && this.kvAliasMap[field]) {
      return `${this.kvAliasMap[field]}.value`;
    } else {
      return `JSON_EXTRACT(json, '$.${field}')`;
    }
  }
}