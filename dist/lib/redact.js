/**
 * Redaction helpers. Every value that crosses an error or diagnostic path
 * passes through these so credentials never reach the terminal or logs.
 */
/** Replace bearer-style credentials and any exact secret occurrence. */
export function redact(text, secret) {
    let out = text.replace(/\bBearer\s+([A-Za-z0-9._~+/=-]{20,})\b/gi, "Bearer ***");
    out = out.replace(/\btally_[A-Za-z0-9_-]{8,}\b/g, "tally_***");
    if (secret && secret.length >= 4) {
        out = out.split(secret).join("***");
    }
    return out;
}
const isAuthorizationHeader = (key) => {
    const normalized = key.toLowerCase().replace(/[_\s]/g, "-");
    return normalized === "authorization" || normalized === "proxy-authorization" || normalized === "x-api-key";
};
/** Structurally scrub credentials from values that may be returned as HTTP diagnostics. */
export function redactSecrets(value, secrets = []) {
    const redactString = (input) => secrets.filter(Boolean).reduce((result, secret) => result.split(secret).join("[REDACTED]"), input);
    if (typeof value === "string")
        return redactString(value);
    if (Array.isArray(value))
        return value.map((item) => redactSecrets(item, secrets));
    if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, isAuthorizationHeader(key) ? "[REDACTED]" : redactSecrets(item, secrets)]));
    }
    return value;
}
