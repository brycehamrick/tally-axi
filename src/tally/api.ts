import { TallyError } from "./errors.js";
import { TallyHttpClient, type HttpOptions } from "./http.js";
import type { CreateWebhookRequest, DeleteResult, Form, FormSummary, JsonObject, Page, PageRequest, Submission, SubmissionSummary, TallyOperations, Webhook } from "./models.js";

const object = (value: unknown): JsonObject => { if (!value || typeof value !== "object" || Array.isArray(value)) throw new TallyError("MALFORMED_RESPONSE", "Tally returned an unexpected response shape."); return value as JsonObject; };
const entity = <T extends JsonObject>(value: unknown): T => { const item = object(value); if (typeof item.id !== "string") throw new TallyError("MALFORMED_RESPONSE", "Tally returned an entity without an ID."); return item as T; };
const page = <T extends JsonObject>(value: unknown, requested: PageRequest = {}): Page<T> => {
  const data = object(value); const raw = data.items ?? data.data ?? data.results;
  if (!Array.isArray(raw)) throw new TallyError("MALFORMED_RESPONSE", "Tally returned a collection without items.");
  const items = raw.map((item) => entity<T>(item)); const current = Number(data.page ?? requested.page ?? 1); const limit = Number(data.limit ?? requested.limit ?? items.length);
  const total = typeof data.total === "number" ? data.total : undefined; const hasMore = typeof data.hasMore === "boolean" ? data.hasMore : total !== undefined ? current * limit < total : items.length === limit && limit > 0;
  return { items, page: current, limit, hasMore, ...(total === undefined ? {} : { total }) };
};
const query = (request: PageRequest = {}) => { const q = new URLSearchParams(); if (request.page) q.set("page", String(request.page)); if (request.limit) q.set("limit", String(request.limit)); return q.size ? `?${q}` : ""; };
const id = encodeURIComponent;

export class TallyApiAdapter implements TallyOperations {
  private readonly http: TallyHttpClient;
  constructor(token: string, options?: HttpOptions) { this.http = new TallyHttpClient(token, options); }
  async listForms(request = {}) { return page<FormSummary>(await this.http.request("GET", `forms${query(request)}`), request); }
  async getForm(formId: string) { return entity<Form>(await this.http.request("GET", `forms/${id(formId)}`)); }
  async listSubmissions(formId: string, request = {}) { return page<SubmissionSummary>(await this.http.request("GET", `forms/${id(formId)}/submissions${query(request)}`), request); }
  async getSubmission(formId: string, submissionId: string) { return entity<Submission>(await this.http.request("GET", `forms/${id(formId)}/submissions/${id(submissionId)}`)); }
  async deleteSubmission(formId: string, submissionId: string): Promise<DeleteResult> { await this.http.request("DELETE", `forms/${id(formId)}/submissions/${id(submissionId)}`); return { deleted: true, id: submissionId }; }
  async listWebhooks(formId: string) { const result = await this.http.request("GET", `forms/${id(formId)}/webhooks`); const raw = Array.isArray(result) ? result : object(result).items; if (!Array.isArray(raw)) throw new TallyError("MALFORMED_RESPONSE", "Tally returned a webhook collection without items."); return raw.map((x) => entity<Webhook>(x)); }
  async createWebhook(request: CreateWebhookRequest) { return entity<Webhook>(await this.http.request("POST", `forms/${id(request.formId)}/webhooks`, { url: request.url, event: request.event ?? "FORM_RESPONSE" })); }
  async deleteWebhook(webhookId: string): Promise<DeleteResult> { await this.http.request("DELETE", `webhooks/${id(webhookId)}`); return { deleted: true, id: webhookId }; }
}
