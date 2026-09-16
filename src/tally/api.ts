import { TallyHttpClient, type HttpOptions } from "./http.js";
import type { CreateWebhookRequest, DeleteResult, Form, FormSummary, PageRequest, Submission, SubmissionSummary, TallyOperations, Webhook } from "./models.js";
import { responseEntity, responseObject, responsePage, responseWebhooks } from "./response.js";
const query = (request: PageRequest = {}) => { const q = new URLSearchParams(); if (request.page) q.set("page", String(request.page)); if (request.limit) q.set("limit", String(request.limit)); return q.size ? `?${q}` : ""; };
const id = encodeURIComponent;

export class TallyApiAdapter implements TallyOperations {
  private readonly http: TallyHttpClient;
  constructor(token: string, options?: HttpOptions) { this.http = new TallyHttpClient(token, options); }
  async listForms(request = {}) { return responsePage<FormSummary>(await this.http.request("GET", `forms${query(request)}`), request); }
  async getForm(formId: string) { return responseEntity<Form>(await this.http.request("GET", `forms/${id(formId)}`)); }
  async listSubmissions(formId: string, request = {}) { return responsePage<SubmissionSummary>(await this.http.request("GET", `forms/${id(formId)}/submissions${query(request)}`), request); }
  async getSubmission(formId: string, submissionId: string) { return responseEntity<Submission>(await this.http.request("GET", `forms/${id(formId)}/submissions/${id(submissionId)}`)); }
  async deleteSubmission(formId: string, submissionId: string): Promise<DeleteResult> { await this.http.request("DELETE", `forms/${id(formId)}/submissions/${id(submissionId)}`); return { deleted: true, id: submissionId }; }
  async listWebhooks(formId: string) { const result = await this.http.request("GET", `forms/${id(formId)}/webhooks`); const raw = Array.isArray(result) ? result : responseObject(result).items; return responseWebhooks(raw); }
  async createWebhook(request: CreateWebhookRequest) { return responseEntity<Webhook>(await this.http.request("POST", `forms/${id(request.formId)}/webhooks`, { url: request.url, event: request.event ?? "FORM_RESPONSE" })); }
  async deleteWebhook(webhookId: string): Promise<DeleteResult> { await this.http.request("DELETE", `webhooks/${id(webhookId)}`); return { deleted: true, id: webhookId }; }
}
