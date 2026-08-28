export function corsOrigins(configured: string | undefined): string[] | boolean {
  const value = configured?.trim();
  if (!value) return false;
  if (value === '*') return true;

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
