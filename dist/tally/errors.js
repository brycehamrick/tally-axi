export class TallyError extends Error {
    code;
    status;
    details;
    retryAfterMs;
    constructor(code, message, status, details, retryAfterMs) {
        super(message);
        this.code = code;
        this.status = status;
        this.details = details;
        this.retryAfterMs = retryAfterMs;
        this.name = "TallyError";
    }
}
export const errorForStatus = (status, details, retryAfterMs) => {
    if (status === 401)
        return new TallyError("AUTHENTICATION_FAILED", "Tally rejected the configured credentials.", status, details);
    if (status === 403)
        return new TallyError("AUTHORIZATION_FAILED", "The credentials may not perform this Tally operation.", status, details);
    if (status === 404)
        return new TallyError("NOT_FOUND", "The requested Tally resource was not found.", status, details);
    if (status === 422 || status === 400)
        return new TallyError("VALIDATION_FAILED", "Tally rejected the request.", status, details);
    if (status === 429)
        return new TallyError("RATE_LIMITED", "Tally rate limited the request.", status, details, retryAfterMs);
    if (status >= 500)
        return new TallyError("TRANSIENT_FAILURE", "Tally is temporarily unavailable.", status, details, retryAfterMs);
    return new TallyError("UPSTREAM_ERROR", "Tally API request failed.", status, details);
};
