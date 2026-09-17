import { redactSecrets } from "../lib/redact.js";
import { errorForStatus, TallyError } from "./errors.js";
/**
 * The only network boundary in the package. Safe reads retry at most twice
 * for network failures, 429, and 5xx; writes and deletes are never retried.
 * Upstream diagnostic bodies are recursively redacted before they leave.
 */
export class TallyHttpClient {
    token;
    baseUrl;
    timeoutMs;
    retries;
    fetcher;
    sleep;
    constructor(token, options = {}) {
        this.token = token;
        this.baseUrl = options.baseUrl ?? "https://api.tally.so";
        this.timeoutMs = options.timeoutMs ?? 10_000;
        this.retries = options.maxRetries ?? 2;
        this.fetcher = options.fetch ?? fetch;
        this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    }
    async request(method, path, body) {
        const safe = method === "GET" || method === "HEAD";
        for (let attempt = 0;; attempt++) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), this.timeoutMs);
            try {
                const response = await this.fetcher(new URL(path, this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`), {
                    method,
                    signal: controller.signal,
                    headers: {
                        Authorization: `Bearer ${this.token}`,
                        Accept: "application/json",
                        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
                    },
                    body: body === undefined ? undefined : JSON.stringify(body),
                });
                const text = await response.text();
                let payload = null;
                if (text) {
                    try {
                        payload = JSON.parse(text);
                    }
                    catch {
                        if (response.ok)
                            throw new TallyError("MALFORMED_RESPONSE", "Tally returned malformed JSON.");
                        payload = { message: text.slice(0, 1000) };
                    }
                }
                if (response.ok)
                    return payload;
                const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
                const error = errorForStatus(response.status, redactSecrets(payload, [this.token]), retryAfter);
                if (!safe || attempt >= this.retries || (response.status !== 429 && response.status < 500))
                    throw error;
                await this.sleep(retryAfter ?? Math.min(250 * 2 ** attempt, 2_000));
            }
            catch (error) {
                if (error instanceof TallyError)
                    throw error;
                if (error.name === "AbortError")
                    throw new TallyError("TIMEOUT", "Tally request timed out.");
                if (!safe || attempt >= this.retries)
                    throw new TallyError("TRANSIENT_FAILURE", "Tally could not be reached.");
                await this.sleep(Math.min(250 * 2 ** attempt, 2_000));
            }
            finally {
                clearTimeout(timer);
            }
        }
    }
}
const parseRetryAfter = (value) => {
    if (!value)
        return undefined;
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0)
        return Math.min(seconds * 1000, 30_000);
    const date = Date.parse(value);
    return Number.isFinite(date) ? Math.min(Math.max(0, date - Date.now()), 30_000) : undefined;
};
