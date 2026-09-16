export type JsonSchema = Record<string, unknown>;

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JsonSchema;
}

const id = (description: string): JsonSchema => ({
  type: "string",
  description,
  minLength: 1,
  maxLength: 200,
  pattern: "^[A-Za-z0-9_-]+$"
});

const object = (properties: Record<string, JsonSchema>, required: string[] = []): JsonSchema => ({
  type: "object",
  properties,
  required,
  additionalProperties: false
});

export const tools: ToolDefinition[] = [
  { name: "tally_list_forms", description: "List forms available to the authenticated Tally account.", inputSchema: object({ page: { type: "number", minimum: 1 }, limit: { type: "number", minimum: 1, maximum: 100 } }) },
  { name: "tally_get_form", description: "Get a Tally form by ID.", inputSchema: object({ formId: id("Tally form ID") }, ["formId"]) },
  { name: "tally_list_submissions", description: "List submissions for a Tally form.", inputSchema: object({ formId: id("Tally form ID"), page: { type: "number", minimum: 1 }, limit: { type: "number", minimum: 1, maximum: 100 } }, ["formId"]) },
  { name: "tally_get_submission", description: "Get one submission belonging to a Tally form.", inputSchema: object({ formId: id("Tally form ID"), submissionId: id("Tally submission ID") }, ["formId", "submissionId"]) },
  { name: "tally_delete_submission", description: "Permanently delete one submission. Requires explicit confirmation.", inputSchema: object({ formId: id("Tally form ID"), submissionId: id("Tally submission ID"), confirm: { type: "boolean", const: true, description: "Must be true to confirm permanent deletion" } }, ["formId", "submissionId", "confirm"]) },
  { name: "tally_list_webhooks", description: "List webhooks for a Tally form.", inputSchema: object({ formId: id("Tally form ID") }, ["formId"]) },
  { name: "tally_create_webhook", description: "Create a webhook for a Tally form.", inputSchema: object({ formId: id("Tally form ID"), url: { type: "string", format: "uri", maxLength: 2048 }, event: { type: "string", enum: ["FORM_RESPONSE"] } }, ["formId", "url"]) },
  { name: "tally_delete_webhook", description: "Permanently delete a webhook. Requires explicit confirmation.", inputSchema: object({ webhookId: id("Tally webhook ID"), confirm: { type: "boolean", const: true, description: "Must be true to confirm permanent deletion" } }, ["webhookId", "confirm"]) }
];
