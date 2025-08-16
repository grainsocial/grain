import { Buffer } from "node:buffer";
import type { RecordTable } from "../../types.d.ts";

export class CursorManager {
  constructor(private tableColumns: string[]) {}

  buildCursorCondition(
    cursor: string,
    orderByClauses: Array<{ field: string; direction?: "asc" | "desc" }>,
    params: Array<string | number | boolean>,
  ): string {
    try {
      const decoded = Buffer.from(cursor, "base64").toString("utf-8");
      const cursorParts = decoded.split("|");
      const cursorCid = cursorParts[cursorParts.length - 1];

      if (cursorParts.length - 1 !== orderByClauses.length) {
        console.warn("Cursor format doesn't match orderBy fields count");
        throw new Error("Invalid cursor format");
      }

      let cursorCondition = "(";
      const clauses: string[] = [];

      for (let i = 0; i < orderByClauses.length; i++) {
        const { field, direction = "asc" } = orderByClauses[i];
        const cursorValue = cursorParts[i];
        const comparisonOp = direction === "desc" ? "<" : ">";

        if (i > 0) {
          let equalityCheck = "(";
          for (let j = 0; j < i; j++) {
            const equalField = orderByClauses[j].field;
            const equalValue = cursorParts[j];

            if (j > 0) equalityCheck += " AND ";

            if (this.tableColumns.includes(equalField)) {
              equalityCheck += `${equalField} = ?`;
            } else {
              equalityCheck += `JSON_EXTRACT(json, '$.${equalField}') = ?`;
            }
            params.push(equalValue);
          }
          equalityCheck += " AND ";

          if (this.tableColumns.includes(field)) {
            equalityCheck += `${field} ${comparisonOp} ?`;
          } else {
            equalityCheck += `JSON_EXTRACT(json, '$.${field}') ${comparisonOp} ?`;
          }
          params.push(cursorValue);
          equalityCheck += ")";

          clauses.push(equalityCheck);
        } else {
          if (this.tableColumns.includes(field)) {
            clauses.push(`${field} ${comparisonOp} ?`);
          } else {
            clauses.push(`JSON_EXTRACT(json, '$.${field}') ${comparisonOp} ?`);
          }
          params.push(cursorValue);
        }
      }

      let finalClause = "(";
      for (let i = 0; i < orderByClauses.length; i++) {
        const { field } = orderByClauses[i];
        const cursorValue = cursorParts[i];

        if (i > 0) finalClause += " AND ";

        if (this.tableColumns.includes(field)) {
          finalClause += `${field} = ?`;
        } else {
          finalClause += `JSON_EXTRACT(json, '$.${field}') = ?`;
        }
        params.push(cursorValue);
      }

      const lastDirection = orderByClauses[orderByClauses.length - 1]?.direction || "asc";
      const cidComparisonOp = lastDirection === "desc" ? "<" : ">";
      finalClause += ` AND cid ${cidComparisonOp} ?`;
      params.push(cursorCid);
      finalClause += ")";

      clauses.push(finalClause);

      cursorCondition += clauses.join(" OR ") + ")";
      return cursorCondition;
    } catch (error) {
      console.warn("Invalid cursor format", error);
      return "";
    }
  }

  generateCursor(
    lastRow: RecordTable,
    orderByClauses: Array<{ field: string; direction?: "asc" | "desc" }>,
  ): string {
    const cursorParts: string[] = [];

    for (const { field } of orderByClauses) {
      if (this.tableColumns.includes(field)) {
        cursorParts.push(String(lastRow[field as keyof RecordTable]));
      } else {
        const parsedJson = JSON.parse(lastRow.json);
        const fieldPath = field.split(".");
        let value = parsedJson;

        for (const key of fieldPath) {
          if (value === undefined || value === null) break;
          value = value[key];
        }

        cursorParts.push(String(value));
      }
    }

    cursorParts.push(lastRow.cid);

    const rawCursor = cursorParts.join("|");
    return Buffer.from(rawCursor, "utf-8").toString("base64");
  }
}