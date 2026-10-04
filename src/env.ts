const required = ['SUPABASE_DB_URL'] as const;

type Required = (typeof required)[number];

export type Env = Record<Required, string>;

export function readEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const missing = required.filter((name) => !source[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
  return Object.fromEntries(
    required.map((name) => [name, source[name] as string]),
  ) as Env;
}
