/**
 * Aggregate CSV construction. Cells are quoted, embedded quotes doubled, and
 * text beginning with a spreadsheet formula character is neutralised so an
 * exported campaign label can never execute as a formula.
 */
export type Cell = string | number | null | undefined;

export function csvCell(value: Cell): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number")
    return Number.isFinite(value) ? String(value) : "";
  let text = value.replace(/\r?\n/g, " ");
  if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text))
    text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(
  meta: [string, Cell][],
  header: string[],
  rows: Cell[][],
) {
  const lines = [
    ...meta.map(([k, v]) => `${csvCell(`# ${k}`)},${csvCell(v)}`),
    header.map(csvCell).join(","),
    ...rows.map((r) => r.map(csvCell).join(",")),
  ];
  return lines.join("\r\n") + "\r\n";
}

/** Minor units to a plain decimal string using the currency's exponent. */
export function minorToDecimal(amount: number, exponent: number) {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  if (exponent === 0) return `${sign}${abs}`;
  const s = String(abs).padStart(exponent + 1, "0");
  return `${sign}${s.slice(0, -exponent)}.${s.slice(-exponent)}`;
}
