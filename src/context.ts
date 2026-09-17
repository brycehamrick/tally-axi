import { resolveConfig, type TallyConfig } from "./lib/env.js";
import { TallyApiAdapter } from "./tally/api.js";
import type { TallyOperations } from "./tally/models.js";

/**
 * Shared command context. Commands receive it lazily so `--help` and version
 * probing never construct a client. Tests construct their own with a fake
 * TallyOperations - no network access outside src/tally/http.ts.
 */

export interface ClientDeps {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export interface CommandContext {
  config: TallyConfig;
  client: TallyOperations;
}

export function createCommandContext(deps: ClientDeps = {}, env: NodeJS.ProcessEnv = process.env): CommandContext {
  const config = resolveConfig(env);
  const client = new TallyApiAdapter(config.apiKey ?? "", {
    baseUrl: config.apiBaseUrl,
    timeoutMs: config.timeoutMs,
    fetch: deps.fetch,
    sleep: deps.sleep,
  });
  return { config, client };
}

let cached: CommandContext | undefined;

export function getCommandContext(): CommandContext {
  cached ??= createCommandContext();
  return cached;
}
