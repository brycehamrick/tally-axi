import { AxiError } from "axi-sdk-js";
import { redact } from "./redact.js";
export const DEFAULT_API_BASE_URL = "https://api.tally.so";
/**
 * Validate a user-supplied API base URL. HTTPS only, no embedded credentials,
 * query, or fragment - the base URL receives the API key as a bearer token.
 */
export function validateApiBaseUrl(raw) {
    let parsed;
    try {
        parsed = new URL(raw);
    }
    catch {
        throw new AxiError(`TALLY_API_BASE_URL is not a valid URL: ${redact(raw)}`, "VALIDATION_ERROR", [
            `Unset TALLY_API_BASE_URL to use the default ${DEFAULT_API_BASE_URL}`,
        ]);
    }
    if (parsed.protocol !== "https:") {
        throw new AxiError(`TALLY_API_BASE_URL must use HTTPS, got protocol ${parsed.protocol}`, "VALIDATION_ERROR", [
            `The public Tally API lives at ${DEFAULT_API_BASE_URL}`,
        ]);
    }
    if (parsed.username || parsed.password) {
        throw new AxiError("TALLY_API_BASE_URL must not contain embedded credentials", "VALIDATION_ERROR", [
            "Pass the API key via the TALLY_API_KEY environment variable instead",
        ]);
    }
    if (parsed.search || parsed.hash) {
        throw new AxiError("TALLY_API_BASE_URL must not contain query parameters or fragments", "VALIDATION_ERROR");
    }
    return parsed.toString().replace(/\/$/, "");
}
/** Read and validate all process configuration in one place. Never throws for a missing key. */
export function resolveConfig(env = process.env) {
    const rawTimeout = env["TALLY_TIMEOUT_MS"]?.trim() || "10000";
    const timeoutMs = Number(rawTimeout);
    if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120000) {
        throw new AxiError("TALLY_TIMEOUT_MS must be an integer from 100 through 120000", "VALIDATION_ERROR", [
            `Got: ${rawTimeout}`,
        ]);
    }
    const apiKey = env["TALLY_API_KEY"]?.trim() || undefined;
    const rawBaseUrl = env["TALLY_API_BASE_URL"]?.trim() || DEFAULT_API_BASE_URL;
    return { apiKey, apiBaseUrl: validateApiBaseUrl(rawBaseUrl), timeoutMs };
}
/** Gate every data command behind a configured key without touching the network. */
export function ensureApiKey(config, commandPath) {
    if (!config.apiKey) {
        throw new AxiError(`${commandPath} requires a Tally API key`, "CONFIGURATION_ERROR", [
            "Create one in Tally settings, then: export TALLY_API_KEY=<your key>",
            "Run `tally-axi` with no arguments to check the current auth state",
        ]);
    }
    return config.apiKey;
}
