import type { CreateWebhookRequest, DeleteResult, Form, FormSummary, Page, PageRequest, Submission, SubmissionSummary, TallyOperations, Webhook } from "./models.js";
import { responseDelete, responseEntity, responsePage, responseWebhooks } from "./response.js";

/** Transport boundary for Tally's hosted MCP server; hosts own MCP/OAuth negotiation. */
export interface McpToolCaller { callTool(name: string, arguments_: Record<string, unknown>): Promise<unknown> }
const names = { listForms: "list_forms", getForm: "get_form", listSubmissions: "list_submissions", getSubmission: "get_submission", deleteSubmission: "delete_submission", listWebhooks: "list_webhooks", createWebhook: "create_webhook", deleteWebhook: "delete_webhook" } as const;
export class TallyMcpAdapter implements TallyOperations {
  constructor(private readonly caller: McpToolCaller) {}
  private call(name: keyof typeof names, args: Record<string, unknown>): Promise<unknown> { return this.caller.callTool(names[name], args); }
  async listForms(request: PageRequest = {}): Promise<Page<FormSummary>> { return responsePage(await this.call("listForms", { ...request }), request); }
  async getForm(formId: string): Promise<Form> { return responseEntity(await this.call("getForm", { formId })); }
  async listSubmissions(formId: string, request: PageRequest = {}): Promise<Page<SubmissionSummary>> { return responsePage(await this.call("listSubmissions", { formId, ...request }), request); }
  async getSubmission(formId: string, submissionId: string): Promise<Submission> { return responseEntity(await this.call("getSubmission", { formId, submissionId })); }
  async deleteSubmission(formId: string, submissionId: string): Promise<DeleteResult> { return responseDelete(await this.call("deleteSubmission", { formId, submissionId }), submissionId); }
  async listWebhooks(formId: string): Promise<Webhook[]> { return responseWebhooks(await this.call("listWebhooks", { formId })); }
  async createWebhook(request: CreateWebhookRequest): Promise<Webhook> { return responseEntity(await this.call("createWebhook", { ...request })); }
  async deleteWebhook(webhookId: string): Promise<DeleteResult> { return responseDelete(await this.call("deleteWebhook", { webhookId }), webhookId); }
}
