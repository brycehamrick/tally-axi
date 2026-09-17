import { resolveConfig } from "./lib/env.js";
import { TallyApiAdapter } from "./tally/api.js";
export function createCommandContext(deps = {}, env = process.env) {
    const config = resolveConfig(env);
    const client = new TallyApiAdapter(config.apiKey ?? "", {
        baseUrl: config.apiBaseUrl,
        timeoutMs: config.timeoutMs,
        fetch: deps.fetch,
        sleep: deps.sleep,
    });
    return { config, client };
}
let cached;
export function getCommandContext() {
    cached ??= createCommandContext();
    return cached;
}
