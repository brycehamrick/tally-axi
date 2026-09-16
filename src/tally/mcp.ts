import { TallyError } from "./errors.js";
import type { CreateWebhookRequest, DeleteResult, Form, FormSummary, Page, PageRequest, Submission, SubmissionSummary, TallyOperations, Webhook } from "./models.js";

/** Transport boundary for Tally's hosted MCP server; hosts own MCP/OAuth negotiation. */
export interface McpToolCaller { callTool(name: string, arguments_: Record<string, unknown>): Promise<unknown> }
const names = { listForms: "list_forms", getForm: "get_form", listSubmissions: "list_submissions", getSubmission: "get_submission", deleteSubmission: "delete_submission", listWebhooks: "list_webhooks", createWebhook: "create_webhook", deleteWebhook: "delete_webhook" } as const;
export class TallyMcpAdapter implements TallyOperations {
  constructor(private readonly caller: McpToolCaller) {}
  private async call<T>(name: keyof typeof names, args: Record<string, unknown>): Promise<T> { const value = await this.caller.callTool(names[name], args); if (value === undefined || value === null) throw new TallyError("MALFORMED_RESPONSE", "Tally MCP returned no structured result."); return value as T; }
  listForms(request: PageRequest = {}) { return this.call<Page<FormSummary>>("listForms", { ...request }); }
  getForm(formId: string) { return this.call<Form>("getForm", { formId }); }
  listSubmissions(formId: string, request: PageRequest = {}) { return this.call<Page<SubmissionSummary>>("listSubmissions", { formId, ...request }); }
  getSubmission(formId: string, submissionId: string) { return this.call<Submission>("getSubmission", { formId, submissionId }); }
  deleteSubmission(formId: string, submissionId: string) { return this.call<DeleteResult>("deleteSubmission", { formId, submissionId }); }
  listWebhooks(formId: string) { return this.call<Webhook[]>("listWebhooks", { formId }); }
  createWebhook(request: CreateWebhookRequest) { return this.call<Webhook>("createWebhook", { ...request }); }
  deleteWebhook(webhookId: string) { return this.call<DeleteResult>("deleteWebhook", { webhookId }); }
}
