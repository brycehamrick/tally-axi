import { TallyError } from "./errors.js";
import type { JsonObject, Page, PageRequest, Webhook } from "./models.js";

/**
 * Response-shape validation for the Tally REST API. Every adapter read passes
 * through these guards so malformed upstream payloads fail as structured
 * MALFORMED_RESPONSE errors instead of leaking into command output.
 */

const malformed = (message: string): never => {
  throw new TallyError("MALFORMED_RESPONSE", message);
};

const integer = (value: unknown, minimum: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= minimum;

export const responseObject = (value: unknown): JsonObject => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return malformed("Tally returned an unexpected response shape.");
  return value as JsonObject;
};

export const responseEntity = <T extends JsonObject>(value: unknown): T => {
  const item = responseObject(value);
  if (typeof item.id !== "string" || item.id.trim().length === 0) return malformed("Tally returned an entity without a valid ID.");
  return item as T;
};

export const responsePage = <T extends JsonObject>(value: unknown, requested: PageRequest = {}): Page<T> => {
  const data = responseObject(value);
  const raw = data.items ?? data.data ?? data.results;
  if (!Array.isArray(raw)) return malformed("Tally returned a collection without a valid item array.");
  const items = raw.map((item) => responseEntity<T>(item));
  const current = data.page ?? requested.page ?? 1;
  const limit = data.limit ?? requested.limit ?? items.length;
  const total = data.total;
  if (!integer(current, 1) || !integer(limit, 0) || (total !== undefined && !integer(total, 0))) {
    return malformed("Tally returned invalid page metadata.");
  }
  // An explicit boolean hasMore wins; otherwise infer it from total, falling
  // back to the "full page" heuristic.
  const hasMore =
    typeof data.hasMore === "boolean"
      ? data.hasMore
      : typeof total === "number"
        ? current * limit < total
        : items.length === limit && limit > 0;
  return { items, page: current, limit, hasMore, ...(typeof total === "number" ? { total } : {}) };
};

export const responseWebhooks = (value: unknown): Webhook[] => {
  const raw = Array.isArray(value) ? value : responseObject(value).items;
  if (!Array.isArray(raw)) return malformed("Tally returned an invalid webhook collection.");
  return raw.map((item) => responseEntity<Webhook>(item));
};
