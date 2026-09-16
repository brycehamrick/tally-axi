export type JsonObject = Record<string, unknown>;

export interface PageRequest { page?: number; limit?: number }
export interface Page<T> { items: T[]; page: number; limit: number; hasMore: boolean; total?: number }
export interface FormSummary extends JsonObject { id: string; name?: string; status?: string }
export interface Form extends FormSummary {}
export interface SubmissionSummary extends JsonObject { id: string; formId?: string; submittedAt?: string }
export interface Submission extends SubmissionSummary {}
export interface Webhook extends JsonObject { id: string; formId?: string; url?: string; event?: string }
export interface CreateWebhookRequest { formId: string; url: string; event?: "FORM_RESPONSE" }
export interface DeleteResult { deleted: true; id: string }

export interface TallyOperations {
  listForms(request?: PageRequest): Promise<Page<FormSummary>>;
  getForm(formId: string): Promise<Form>;
  listSubmissions(formId: string, request?: PageRequest): Promise<Page<SubmissionSummary>>;
  getSubmission(formId: string, submissionId: string): Promise<Submission>;
  deleteSubmission(formId: string, submissionId: string): Promise<DeleteResult>;
  listWebhooks(formId: string): Promise<Webhook[]>;
  createWebhook(request: CreateWebhookRequest): Promise<Webhook>;
  deleteWebhook(webhookId: string): Promise<DeleteResult>;
}
