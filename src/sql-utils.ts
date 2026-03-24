/**
 * Escape a SQL identifier by doubling any embedded backticks,
 * then wrapping in backticks. Prevents backtick breakout injection.
 */
export function escapeIdentifier(id: string): string {
  return "`" + id.replace(/`/g, "``") + "`";
}

/**
 * Validate that a value is a simple SQL identifier (alphanumeric + underscore).
 * Used for values like charset and collation that cannot be parameterized
 * or backtick-quoted in MySQL DDL.
 */
export function validateSimpleIdentifier(value: string, label: string): void {
  if (!/^[a-zA-Z0-9_]+$/.test(value)) {
    throw new Error(
      `Invalid ${label}: '${value}'. Only letters, numbers, and underscores are allowed.`
    );
  }
}
