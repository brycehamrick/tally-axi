import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { TallyApiAdapter } from "../dist/tally/api.js";
import { TallyHttpClient } from "../dist/tally/http.js";
import { TallyError } from "../dist/tally/errors.js";
import { TallyMcpAdapter } from "../dist/tally/mcp.js";
import { invoke } from "../dist/index.js";

const json = (value, init = {}) => new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" }, ...init });
const SYNTHETIC_TEST_API_KEY = "tally_test_synthetic_key_not_valid_00000000";
const mockApi = (responses) => { const calls = []; const fetch = async (url, options) => { calls.push({ url: String(url), options }); const next = responses.shift(); return typeof next === "function" ? next(url, options) : next; }; return { api: new TallyApiAdapter(SYNTHETIC_TEST_API_KEY, { fetch, sleep: async () => {} }), calls }; };

test("contracts every public API operation and normalizes output", async () => {
  const { api, calls } = mockApi([
    json({ items: [{ id: "f1", name: "Form" }], page: 2, limit: 1, total: 3 }), json({ id: "f1", name: "Form" }),
    json({ data: [{ id: "s1" }], page: 1, limit: 10, hasMore: false }), json({ id: "s1", fields: [{ sensitive: "kept only for explicit get" }] }),
    new Response(null, { status: 204 }), json({ items: [{ id: "w1" }] }), json({ id: "w2", url: "https://example.com/hook" }), new Response(null, { status: 204 })
  ]);
  assert.deepEqual(await api.listForms({ page: 2, limit: 1 }), { items: [{ id: "f1", name: "Form" }], page: 2, limit: 1, hasMore: true, total: 3 });
  assert.equal((await api.getForm("f1")).id, "f1");
  assert.equal((await api.listSubmissions("f1", { limit: 10 })).items[0].id, "s1");
  assert.equal((await api.getSubmission("f1", "s1")).id, "s1");
  assert.deepEqual(await api.deleteSubmission("f1", "s1"), { deleted: true, id: "s1" });
  assert.equal((await api.listWebhooks("f1"))[0].id, "w1");
  assert.equal((await api.createWebhook({ formId: "f1", url: "https://example.com/hook" })).id, "w2");
  assert.deepEqual(await api.deleteWebhook("w2"), { deleted: true, id: "w2" });
  assert.deepEqual(calls.map((x) => [x.options.method, new URL(x.url).pathname]), [["GET","/forms"],["GET","/forms/f1"],["GET","/forms/f1/submissions"],["GET","/forms/f1/submissions/s1"],["DELETE","/forms/f1/submissions/s1"],["GET","/forms/f1/webhooks"],["POST","/forms/f1/webhooks"],["DELETE","/webhooks/w2"]]);
  assert.ok(calls.every((x) => !JSON.stringify(x).includes("response-headers")));
});

test("MCP adapter exposes every equivalent operation through the shared contract", async () => {
  const calls = []; const mcp = new TallyMcpAdapter({ callTool: async (name, args) => { calls.push([name, args]); if (name.startsWith("list_")) return name === "list_webhooks" ? [] : { items: [], page: 1, limit: 0, hasMore: false }; if (name.startsWith("delete_")) return { deleted: true, id: args.webhookId ?? args.submissionId }; return { id: "x" }; } });
  await mcp.listForms(); await mcp.getForm("f"); await mcp.listSubmissions("f"); await mcp.getSubmission("f", "s"); await mcp.deleteSubmission("f", "s"); await mcp.listWebhooks("f"); await mcp.createWebhook({ formId: "f", url: "https://x.test" }); await mcp.deleteWebhook("w");
  assert.deepEqual(calls.map((x) => x[0]), ["list_forms","get_form","list_submissions","get_submission","delete_submission","list_webhooks","create_webhook","delete_webhook"]);
});

test("paginates deterministically and rejects malformed success responses", async () => {
  const { api } = mockApi([json({ results: [{ id: "a" }, { id: "b" }] }), new Response("not json", { status: 200 })]);
  assert.deepEqual(await api.listForms({ page: 3, limit: 2 }), { items: [{ id: "a" }, { id: "b" }], page: 3, limit: 2, hasMore: true });
  await assert.rejects(api.getForm("x"), (e) => e instanceof TallyError && e.code === "MALFORMED_RESPONSE");
});

test("maps HTTP failures and redacts credentials", async () => {
  for (const [status, code] of [[401,"AUTHENTICATION_FAILED"],[403,"AUTHORIZATION_FAILED"],[404,"NOT_FOUND"],[422,"VALIDATION_FAILED"],[418,"UPSTREAM_ERROR"]]) {
    const secret = SYNTHETIC_TEST_API_KEY; const client = new TallyHttpClient(secret, { maxRetries: 0, fetch: async () => json({ Authorization: `Bearer ${secret}`, message: secret }, { status }) });
    await assert.rejects(client.request("GET", "forms"), (e) => e.code === code && !JSON.stringify(e.details).includes(secret) && e.details.Authorization === "[REDACTED]");
  }
});

test("retries only safe transient failures and honors Retry-After", async () => {
  let attempts = 0; const delays = []; const client = new TallyHttpClient("x", { maxRetries: 2, sleep: async (ms) => delays.push(ms), fetch: async () => ++attempts < 3 ? json({}, { status: 429, headers: { "retry-after": "1" } }) : json({ ok: true }) });
  assert.deepEqual(await client.request("GET", "forms"), { ok: true }); assert.equal(attempts, 3); assert.deepEqual(delays, [1000, 1000]);
  attempts = 0; const write = new TallyHttpClient("x", { fetch: async () => { attempts++; return json({}, { status: 503 }); }, sleep: async () => {} });
  await assert.rejects(write.request("POST", "forms", {}), (e) => e.code === "TRANSIENT_FAILURE"); assert.equal(attempts, 1);
});

test("turns aborts into stable timeout errors", async () => {
  const client = new TallyHttpClient("x", { timeoutMs: 1, fetch: (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))) });
  await assert.rejects(client.request("GET", "forms"), (e) => e.code === "TIMEOUT");
});

test("destructive tools refuse absent or false confirmation before backend use", async () => {
  let called = false; const backend = new Proxy({}, { get: () => async () => { called = true; } });
  await assert.rejects(invoke({ tool: "tally_delete_submission", input: { formId: "f", submissionId: "s" } }, {}, backend), /Invalid tool input/);
  await assert.rejects(invoke({ tool: "tally_delete_webhook", input: { webhookId: "w", confirm: false } }, {}, backend), /Invalid tool input/);
  assert.equal(called, false);
});

test("CLI reports configuration and validation failures without secrets", () => {
  const result = spawnSync(process.execPath, ["dist/index.js"], { input: JSON.stringify({ tool: "tally_list_forms", input: {} }), encoding: "utf8", env: { ...process.env, TALLY_API_KEY: "" } });
  assert.equal(result.status, 1); assert.equal(JSON.parse(result.stdout).error.code, "CONFIGURATION_ERROR"); assert.doesNotMatch(result.stdout, /Bearer/);
});
