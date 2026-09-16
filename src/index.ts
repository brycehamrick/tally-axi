#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { TallyClient, ApiError } from "./client.js";
import { tools } from "./tools.js";
import { validate, InputError } from "./validation.js";

type Envelope = { tool: string; input?: unknown };
const encode = (value: unknown) => `${JSON.stringify(value)}\n`;
const segment = (value: unknown) => encodeURIComponent(String(value));
const query = (input: Record<string, unknown>) => {
  const params = new URLSearchParams();
  for (const key of ["page", "limit"]) if (input[key] !== undefined) params.set(key, String(input[key]));
  return params.size ? `?${params}` : "";
};

export async function invoke(request: Envelope, env = process.env): Promise<unknown> {
  const definition = tools.find((item) => item.name === request.tool);
  if (!definition) throw new InputError("Unknown tool", { tool: request.tool });
  const input = validate(definition.inputSchema, request.input ?? {});
  const apiKey = env.TALLY_API_KEY;
  if (!apiKey) throw new InputError("TALLY_API_KEY is required");
  const client = new TallyClient(apiKey, env.TALLY_API_BASE_URL);
  const form = segment(input.formId);
  const submission = segment(input.submissionId);
  switch (request.tool) {
    case "tally_list_forms": return client.request("GET", `forms${query(input)}`);
    case "tally_get_form": return client.request("GET", `forms/${form}`);
    case "tally_list_submissions": return client.request("GET", `forms/${form}/submissions${query(input)}`);
    case "tally_get_submission": return client.request("GET", `forms/${form}/submissions/${submission}`);
    case "tally_delete_submission": return client.request("DELETE", `forms/${form}/submissions/${submission}`);
    case "tally_list_webhooks": return client.request("GET", `forms/${form}/webhooks`);
    case "tally_create_webhook": return client.request("POST", `forms/${form}/webhooks`, { url: input.url, event: input.event ?? "FORM_RESPONSE" });
    case "tally_delete_webhook": return client.request("DELETE", `webhooks/${segment(input.webhookId)}`);
    default: throw new InputError("Unknown tool");
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args[0] === "--list-tools") { process.stdout.write(encode({ ok: true, data: tools })); return; }
  if (args[0] === "--manifest") {
    const path = fileURLToPath(new URL("../axi.json", import.meta.url));
    process.stdout.write(encode({ ok: true, data: JSON.parse(await readFile(path, "utf8")) })); return;
  }
  let raw = "";
  if (args[0] === "--call") raw = JSON.stringify({ tool: args[1], input: args[2] ? JSON.parse(args[2]) : {} });
  else raw = await new Promise<string>((resolve) => { let value = ""; process.stdin.setEncoding("utf8"); process.stdin.on("data", (chunk = "") => value += chunk); process.stdin.on("end", () => resolve(value)); });
  if (!raw.trim()) throw new InputError("Provide a JSON request on stdin or use --call");
  const request = JSON.parse(raw) as Envelope;
  if (!request || typeof request.tool !== "string") throw new InputError("Request must include a tool string");
  process.stdout.write(encode({ ok: true, data: await invoke(request) }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((error: unknown) => {
  const known = error instanceof InputError || error instanceof ApiError;
  const status = error instanceof ApiError ? error.status : undefined;
  const details = error instanceof InputError || error instanceof ApiError ? error.details : undefined;
  process.stdout.write(encode({ ok: false, error: { code: error instanceof InputError ? "INVALID_INPUT" : error instanceof ApiError ? "TALLY_API_ERROR" : "INTERNAL_ERROR", message: known ? error.message : "Unexpected error", ...(status ? { status } : {}), ...(details === undefined ? {} : { details }) } }));
  process.exitCode = 1;
});
