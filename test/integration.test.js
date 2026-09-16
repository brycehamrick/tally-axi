import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const run = (args, input, env = {}) => spawnSync(process.execPath, ["dist/index.js", ...args], { input, encoding: "utf8", env: { ...process.env, ...env } });

test("lists machine-readable tool definitions", () => {
  const result = run(["--list-tools"]);
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

test("does not expose a missing credential", () => {
  const result = run([], JSON.stringify({ tool: "tally_list_forms", input: {} }), { TALLY_API_KEY: "" });
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).error.code, "INVALID_INPUT");
  assert.doesNotMatch(result.stdout, /Bearer/);
});
