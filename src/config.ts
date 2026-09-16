/** Environment variable used for Tally API authentication. */
export const TALLY_API_KEY_ENV = "TALLY_API_KEY";

export interface Config {
  apiKey: string;
  apiBaseUrl?: string;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/** Read and validate all process configuration in one place. */
export function readConfig(env: Record<string, string | undefined> = process.env): Config {
  const apiKey = env[TALLY_API_KEY_ENV]?.trim();
  if (!apiKey) throw new ConfigError("Set TALLY_API_KEY to an API key created in Tally settings.");
  return { apiKey, ...(env.TALLY_API_BASE_URL ? { apiBaseUrl: env.TALLY_API_BASE_URL } : {}) };
}

const isAuthorizationHeader = (key: string): boolean => {
  const normalized = key.toLowerCase().replace(/[_\s]/g, "-");
  return normalized === "authorization" || normalized === "proxy-authorization" || normalized === "x-api-key";
};

/** Remove credentials from values that may be returned as HTTP diagnostics. */
export function redactSecrets(value: unknown, secrets: readonly string[] = []): unknown {
  const redactString = (input: string) => secrets.filter(Boolean).reduce((result, secret) => result.split(secret).join("[REDACTED]"), input);
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item, secrets));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, isAuthorizationHeader(key) ? "[REDACTED]" : redactSecrets(item, secrets)]));
  }
  return value;
}
