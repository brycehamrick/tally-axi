import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const run = (args, input, env = {}) => spawnSync(process.execPath, ["dist/index.js", ...args], { input, encoding: "utf8", env: { ...process.env, ...env } });
const configured = { TALLY_API_KEY: "not-a-real-key" };

test("lists machine-readable tool definitions", () => {
  const result = run(["--list-tools"], undefined, configured);
  assert.equal(result.status, 0);
  const response = JSON.parse(result.stdout);
  assert.equal(response.ok, true);
  assert.ok(response.data.some((tool) => tool.name === "tally_list_forms"));
});

test("rejects invalid input without making a request", () => {
  const result = run([], JSON.stringify({ tool: "tally_get_form", input: { formId: "bad/id" } }), { TALLY_API_KEY: "not-a-real-key" });
  assert.equal(result.status, 1);
  assert.deepEqual(JSON.parse(result.stdout), { ok: false, error: { code: "INVALID_INPUT", message: "Invalid tool input", details: { errors: ["formId has an invalid format"] } } });
});

test("fails at startup with remediation when the API key is missing", () => {
  const result = run([], JSON.stringify({ tool: "tally_list_forms", input: {} }), { TALLY_API_KEY: "" });
  assert.equal(result.status, 1);
  assert.deepEqual(JSON.parse(result.stdout), { ok: false, error: { code: "CONFIGURATION_ERROR", message: "Set TALLY_API_KEY to an API key created in Tally settings." } });
  assert.doesNotMatch(result.stdout, /Bearer/);
});

test("redacts secrets and authorization headers from HTTP error diagnostics", async () => {
  const secret = "super-secret-tally-key";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => new Response(JSON.stringify({
    message: `request using ${secret} failed`,
    headers: { Authorization: options.headers.Authorization, "proxy-authorization": secret, "x-api-key": secret, Accept: "application/json" }
  }), { status: 401, headers: { "content-type": "application/json" } });
  try {
    const { TallyClient, ApiError } = await import("../dist/client.js");
    await assert.rejects(new TallyClient(secret).request("GET", "forms"), (error) => {
      assert.ok(error instanceof ApiError);
      const serialized = JSON.stringify(error.details);
      assert.doesNotMatch(serialized, new RegExp(secret));
      assert.deepEqual(error.details, { message: "request using [REDACTED] failed", headers: { Authorization: "[REDACTED]", "proxy-authorization": "[REDACTED]", "x-api-key": "[REDACTED]", Accept: "application/json" } });
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
