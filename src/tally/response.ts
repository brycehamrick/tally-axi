import { TallyError } from "./errors.js";
import type { DeleteResult, JsonObject, Page, PageRequest, Webhook } from "./models.js";

const malformed = (message: string): never => { throw new TallyError("MALFORMED_RESPONSE", message); };
const integer = (value: unknown, minimum: number): value is number => typeof value === "number" && Number.isInteger(value) && value >= minimum;

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
  if (!integer(current, 1) || !integer(limit, 0) || (total !== undefined && !integer(total, 0))) return malformed("Tally returned invalid page metadata.");
  if ((limit > 0 && items.length > limit) || (typeof total === "number" && total < items.length)) return malformed("Tally returned incoherent page metadata.");
  const inferredHasMore = typeof total === "number" ? current * limit < total : items.length === limit && limit > 0;
  const hasMore = data.hasMore ?? inferredHasMore;
  if (typeof hasMore !== "boolean" || (typeof total === "number" && hasMore !== inferredHasMore)) return malformed("Tally returned incoherent page metadata.");
  return { items, page: current, limit, hasMore, ...(typeof total === "number" ? { total } : {}) };
};

export const responseWebhooks = (value: unknown): Webhook[] => {
  if (!Array.isArray(value)) return malformed("Tally returned an invalid webhook collection.");
  return value.map((item) => responseEntity<Webhook>(item));
};

export const responseDelete = (value: unknown, expectedId: string): DeleteResult => {
  const result = responseObject(value);
  if (result.deleted !== true || typeof result.id !== "string" || result.id.trim().length === 0 || result.id !== expectedId) return malformed("Tally returned an invalid delete result.");
  return { deleted: true, id: result.id };
};
