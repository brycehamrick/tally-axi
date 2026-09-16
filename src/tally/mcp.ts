import { TallyError } from "./errors.js";
import type { Form, FormSummary, JsonObject, Page, PageRequest, Submission, SubmissionSummary } from "./models.js";

/** Transport boundary for Tally's hosted MCP server; hosts own MCP/OAuth negotiation. */
export interface McpToolCaller { callTool(name: string, arguments_: Record<string, unknown>): Promise<unknown> }

export interface Workspace extends JsonObject { id: string; name?: string }

/**
 * Operations verified against Tally's native MCP tools/list contract.
 *
 * This deliberately does not implement TallyOperations: deletion and webhook
 * management are public-API features, not tools exposed by the native server.
 */
export class TallyMcpAdapter {
  constructor(private readonly caller: McpToolCaller) {}

  private async call<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const value = await this.caller.callTool(name, args);
    if (value === undefined || value === null) throw new TallyError("MALFORMED_RESPONSE", "Tally MCP returned no structured result.");
    return value as T;
  }

  listWorkspaces() { return this.call<Workspace[]>("list_workspaces", {}); }
  listForms(workspaceId?: string, request: PageRequest = {}) {
    return this.call<Page<FormSummary>>("list_forms", { ...(workspaceId === undefined ? {} : { workspace_id: workspaceId }), ...request });
  }
  getForm(formId: string) { return this.call<Form>("get_form", { form_id: formId }); }
  listSubmissions(formId: string, request: PageRequest = {}) {
    return this.call<Page<SubmissionSummary>>("list_submissions", { form_id: formId, ...request });
  }
  getSubmission(submissionId: string) { return this.call<Submission>("get_submission", { submission_id: submissionId }); }
}
