/**
 * AXI principle 3: truncate large text with a size hint and a --full escape
 * hatch. Singleton outputs carry the hint inline; list outputs set
 * `truncated: true` so callers can emit one aggregate hint line instead of
 * per-row noise.
 */

export interface TruncatedText {
  value: string;
  truncated: boolean;
  totalChars: number;
}

export function truncateText(text: string, limit: number): TruncatedText {
  if (text.length <= limit) {
    return { value: text, truncated: false, totalChars: text.length };
  }
  const cut = Array.from(text).slice(0, limit).join("");
  return {
    value: `${cut}\u2026(truncated, ${text.length} chars total \u2014 use --full)`,
    truncated: true,
    totalChars: text.length,
  };
}

/** Compact single-line snippet for list rows: ellipsis only, no inline hint. */
export function snippet(text: string | undefined, limit: number): string | undefined {
  if (text === undefined) return undefined;
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= limit) return flat;
  return `${Array.from(flat).slice(0, limit).join("")}\u2026`;
}

export function truncationHint(fieldsTruncated: number, commandPath: string): string[] {
  if (fieldsTruncated === 0) return [];
  return [
    `${fieldsTruncated} field${fieldsTruncated > 1 ? "s" : ""} truncated \u2014 rerun with --full for complete text`,
  ];
}

interface DeepTruncation {
  value: unknown;
  truncatedFields: number;
}

/**
 * Walk a JSON-shaped entity and cap every long string, so entity views stay
 * truthful without inventing a schema. Upstream payloads are JSON and
 * therefore acyclic.
 */
export function truncateStringsDeep(value: unknown, limit: number): DeepTruncation {
  if (typeof value === "string") {
    const result = truncateText(value, limit);
    return { value: result.value, truncatedFields: result.truncated ? 1 : 0 };
  }
  if (Array.isArray(value)) {
    let truncatedFields = 0;
    const items = value.map((item) => {
      const nested = truncateStringsDeep(item, limit);
      truncatedFields += nested.truncatedFields;
      return nested.value;
    });
    return { value: items, truncatedFields };
  }
  if (value && typeof value === "object") {
    let truncatedFields = 0;
    const entries = Object.entries(value).map(([key, item]) => {
      const nested = truncateStringsDeep(item, limit);
      truncatedFields += nested.truncatedFields;
      return [key, nested.value];
    });
    return { value: Object.fromEntries(entries), truncatedFields };
  }
  return { value, truncatedFields: 0 };
}
