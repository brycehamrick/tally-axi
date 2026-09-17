/** Small safe-accessor helpers for untyped upstream JSON. */
export function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function asString(value) {
    return typeof value === "string" ? value : undefined;
}
export function asStringArray(value) {
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : undefined;
}
/** Drop undefined and null keys so TOON rows stay minimal (AXI principle 2). */
export function compact(input) {
    return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined && value !== null));
}
