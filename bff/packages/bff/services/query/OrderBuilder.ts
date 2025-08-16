export class OrderBuilder {
  constructor(private tableColumns: string[]) {}

  buildOrderClause(
    orderByClauses: Array<{ field: string; direction?: "asc" | "desc" }>,
  ): string {
    if (orderByClauses.length === 0) return "";

    const orderParts: string[] = [];

    for (const { field, direction = "asc" } of orderByClauses) {
      if (this.tableColumns.includes(field)) {
        orderParts.push(`${field} ${direction}`);
      } else {
        orderParts.push(`JSON_EXTRACT(json, '$.${field}') ${direction}`);
      }
    }

    const lastDirection = orderByClauses[orderByClauses.length - 1]?.direction || "asc";
    orderParts.push(`cid ${lastDirection}`);

    return ` ORDER BY ${orderParts.join(", ")}`;
  }
}