const RISKY_PREFIX = /^[=+\-@\t\r]/;

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const escape = (input: unknown): string => {
    let value = input === null || input === undefined ? '' : String(input);
    if (RISKY_PREFIX.test(value)) value = `'${value}`;
    if (/[",\n\r]/.test(value)) {
      return `"${value.replaceAll('"', '""')}"`;
    }
    return value;
  };

  const lines = [columns.map((column) => escape(column.header)).join(',')];
  for (const row of rows) {
    lines.push(columns.map((column) => escape(column.value(row))).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}
