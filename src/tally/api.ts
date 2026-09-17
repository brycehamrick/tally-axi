import { TallyHttpClient, type HttpOptions } from "./http.js";
import type {
  CreateWebhookRequest,
  DeleteResult,
  Form,
  FormSummary,
  Page,
  PageRequest,
  Submission,
  SubmissionSummary,
  TallyOperations,
  Webhook,
} from "./models.js";
import { responseEntity, responseObject, responsePage, responseWebhooks } from "./response.js";

const query = (request: PageRequest = {}) => {
  const q = new URLSearchParams();
  if (request.page) q.set("page", String(request.page));
  if (request.limit) q.set("limit", String(request.limit));
  return q.size ? `?${q}` : "";
};
const id = encodeURIComponent;

/** Typed adapter for the public Tally REST API (see developers.tally.so). */
export class TallyApiAdapter implements TallyOperations {
  private readonly http: TallyHttpClient;

  constructor(token: string, options?: HttpOptions) {
    this.http = new TallyHttpClient(token, options);
  }

  async listForms(request = {}): Promise<Page<FormSummary>> {
    return responsePage<FormSummary>(await this.http.request("GET", `forms${query(request)}`), request);
  }
  async getForm(formId: string): Promise<Form> {
    return responseEntity<Form>(await this.http.request("GET", `forms/${id(formId)}`));
  }
  async listSubmissions(formId: string, request = {}): Promise<Page<SubmissionSummary>> {
    return responsePage<SubmissionSummary>(await this.http.request("GET", `forms/${id(formId)}/submissions${query(request)}`), request);
  }
  async getSubmission(formId: string, submissionId: string): Promise<Submission> {
    return responseEntity<Submission>(await this.http.request("GET", `forms/${id(formId)}/submissions/${id(submissionId)}`));
  }
  async deleteSubmission(formId: string, submissionId: string): Promise<DeleteResult> {
    await this.http.request("DELETE", `forms/${id(formId)}/submissions/${id(submissionId)}`);
    return { deleted: true, id: submissionId };
  }
  async listWebhooks(formId: string): Promise<Webhook[]> {
    return responseWebhooks(await this.http.request("GET", `forms/${id(formId)}/webhooks`));
  }
  async createWebhook(request: CreateWebhookRequest): Promise<Webhook> {
    return responseEntity<Webhook>(await this.http.request("POST", `forms/${id(request.formId)}/webhooks`, { url: request.url, event: request.event ?? "FORM_RESPONSE" }));
  }
  async deleteWebhook(webhookId: string): Promise<DeleteResult> {
    await this.http.request("DELETE", `webhooks/${id(webhookId)}`);
    return { deleted: true, id: webhookId };
  }
}
