#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { TallyApiAdapter } from "./tally/api.js";
import { TallyError } from "./tally/errors.js";
import type { TallyOperations } from "./tally/models.js";
import { ConfigError, readConfig } from "./config.js";
import { tools } from "./tools.js";
import { validate, InputError } from "./validation.js";

type Envelope = { tool: string; input?: unknown };
const encode = (value: unknown) => `${JSON.stringify(value)}\n`;

/** Parse untrusted request JSON without reflecting its potentially sensitive contents. */
export function parseRequestJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (error) {
    if (error instanceof SyntaxError) throw new InputError("Request must be valid JSON");
    throw error;
  }
}

/** Invoke one narrow operation. Dependency injection keeps API and MCP behind one interface. */
export async function invoke(request: Envelope, env = process.env, backend?: TallyOperations): Promise<unknown> {
  const definition = tools.find((item) => item.name === request.tool);
  if (!definition) throw new InputError("Unknown tool", { tool: request.tool });
  const input = validate(definition.inputSchema, request.input ?? {});
  const config = backend ? undefined : readConfig(env);
  const client = backend ?? new TallyApiAdapter(config!.apiKey, { baseUrl: config!.apiBaseUrl, timeoutMs: config!.timeoutMs });
  const formId = input.formId as string; const submissionId = input.submissionId as string;
  switch (request.tool) {
    case "tally_list_forms": return client.listForms({ page: input.page as number | undefined, limit: input.limit as number | undefined });
    case "tally_get_form": return client.getForm(formId);
    case "tally_list_submissions": return client.listSubmissions(formId, { page: input.page as number | undefined, limit: input.limit as number | undefined });
    case "tally_get_submission": return client.getSubmission(formId, submissionId);
    case "tally_delete_submission": return client.deleteSubmission(formId, submissionId);
    case "tally_list_webhooks": return client.listWebhooks(formId);
    case "tally_create_webhook": return client.createWebhook({ formId, url: input.url as string, event: input.event as "FORM_RESPONSE" | undefined });
    case "tally_delete_webhook": return client.deleteWebhook(input.webhookId as string);
    default: throw new InputError("Unknown tool");
  }
}

async function main(): Promise<void> {
  readConfig(process.env); const args = process.argv.slice(2);
  if (args[0] === "--list-tools") { process.stdout.write(encode({ ok: true, data: tools })); return; }
  if (args[0] === "--manifest") { const path = fileURLToPath(new URL("../axi.json", import.meta.url)); process.stdout.write(encode({ ok: true, data: JSON.parse(await readFile(path, "utf8")) })); return; }
  let request: Envelope;
  if (args[0] === "--call") request = { tool: args[1], input: args[2] ? parseRequestJson(args[2]) : {} } as Envelope;
  else {
    const raw = await new Promise<string>((resolve) => { let value = ""; process.stdin.setEncoding("utf8"); process.stdin.on("data", (chunk = "") => value += chunk); process.stdin.on("end", () => resolve(value)); });
    if (!raw.trim()) throw new InputError("Provide a JSON request on stdin or use --call");
    request = parseRequestJson(raw) as Envelope;
  }
  if (!request || typeof request.tool !== "string") throw new InputError("Request must include a tool string");
  process.stdout.write(encode({ ok: true, data: await invoke(request) }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((error: unknown) => {
  const known = error instanceof InputError || error instanceof TallyError || error instanceof ConfigError;
  const details = error instanceof InputError || error instanceof TallyError ? error.details : undefined;
  const code = error instanceof ConfigError ? "CONFIGURATION_ERROR"
    : error instanceof InputError ? "INVALID_INPUT"
      : error instanceof TallyError ? error.code : "INTERNAL_ERROR";
  process.stdout.write(encode({ ok: false, error: {
    code,
    message: known ? error.message : "Unexpected error",
    ...(error instanceof TallyError && error.status ? { status: error.status } : {}),
    ...(error instanceof TallyError && error.retryAfterMs !== undefined ? { retryAfterMs: error.retryAfterMs } : {}),
    ...(details === undefined ? {} : { details })
  } }));
  process.exitCode = 1;
});
