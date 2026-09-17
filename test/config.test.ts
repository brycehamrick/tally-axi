import { describe, expect, it } from "vitest";
import { AxiError } from "axi-sdk-js";
import { ensureApiKey, resolveConfig, validateApiBaseUrl } from "../src/lib/env.js";
import { redact, redactSecrets } from "../src/lib/redact.js";
import { parseFlags, requireConfirm, requireHttpsUrl, requirePositional } from "../src/lib/args.js";
import { truncateStringsDeep, truncateText, snippet } from "../src/lib/truncate.js";
import { toAxiError } from "../src/index.js";
import { TallyError } from "../src/tally/errors.js";

describe("resolveConfig", () => {
  it("tolerates a missing key so the home view stays keyless-safe", () => {
    expect(resolveConfig({})["apiKey"]).toBeUndefined();
  });

  it("trims surrounding whitespace from the key", () => {
    expect(resolveConfig({ TALLY_API_KEY: "  key  " })["apiKey"]).toBe("key");
  });

  it("validates the timeout bounds", () => {
    expect(resolveConfig({})["timeoutMs"]).toBe(10000);
    expect(() => resolveConfig({ TALLY_TIMEOUT_MS: "50" })).toThrow(AxiError);
    expect(() => resolveConfig({ TALLY_TIMEOUT_MS: "nope" })).toThrow(AxiError);
    expect(resolveConfig({ TALLY_TIMEOUT_MS: "120000" })["timeoutMs"]).toBe(120000);
  });

  it("requires an https base URL without credentials", () => {
    expect(resolveConfig({ TALLY_API_BASE_URL: "https://test.example.com" })["apiBaseUrl"]).toBe("https://test.example.com");
    expect(() => resolveConfig({ TALLY_API_BASE_URL: "http://test.example.com" })).toThrow(/HTTPS/);
    expect(() => resolveConfig({ TALLY_API_BASE_URL: "https://key@evil.example.com" })).toThrow(/credentials/);
  });
});

describe("ensureApiKey", () => {
  it("throws CONFIGURATION_ERROR with setup guidance and no network", () => {
    try {
      ensureApiKey({ apiBaseUrl: "https://api.tally.so", timeoutMs: 10000 }, "tally-axi forms list");
      expect.unreachable();
    } catch (error) {
      expect(error).toMatchObject({ code: "CONFIGURATION_ERROR" });
      expect((error as AxiError).suggestions.join(" ")).toContain("TALLY_API_KEY");
    }
  });
});

describe("redaction", () => {
  it("scrubs bearer tokens and exact secrets from text", () => {
    const secret = "tally_super_secret_value_123456";
    const text = `Authorization: Bearer ${secret} in url`;
    expect(redact(text, secret)).not.toContain(secret);
    expect(redact("Bearer abcdefghijklmnopqrstuvwxyz")).toContain("***");
  });

  it("structurally redacts authorization headers in diagnostics", () => {
    const out = redactSecrets({ authorization: "Bearer x", nested: { "x-api-key": "y", keep: 1 } });
    expect(out).toEqual({ authorization: "[REDACTED]", nested: { "x-api-key": "[REDACTED]", keep: 1 } });
  });
});

describe("args", () => {
  it("fails loud on unknown flags with the valid set", () => {
    try {
      parseFlags(["--limit", "5", "--bogus"], "tally-axi forms list", { limit: { type: "string" } });
      expect.unreachable();
    } catch (error) {
      expect(error).toMatchObject({ code: "VALIDATION_ERROR" });
      expect((error as AxiError).suggestions[0]).toContain("--limit <limit>");
    }
  });

  it("requires positionals and forbids extras", () => {
    expect(() => requirePositional([], 0, "formId", "tally-axi forms get")).toThrow(/missing <formId>/);
    expect(() => requirePositional(["  "], 0, "formId", "tally-axi forms get")).toThrow(/missing/);
    expect(requirePositional([" f1 "], 0, "formId", "x")).toBe("f1");
  });

  it("validates https webhook URLs", () => {
    expect(requireHttpsUrl("https://example.com/h", "--url")).toBe("https://example.com/h");
    expect(() => requireHttpsUrl("ftp://example.com", "--url")).toThrow(/https/);
    expect(() => requireHttpsUrl("not-a-url", "--url")).toThrow(AxiError);
  });

  it("requireConfirm previews the mutation and refuses without --confirm", () => {
    const flags = parseFlags(["delete", "f1"], "x", { confirm: { type: "boolean" } }).values;
    expect(() => requireConfirm(flags, "tally-axi submissions delete", "delete s1")).toThrow(/--confirm/);
    const ok = parseFlags(["--confirm"], "x", { confirm: { type: "boolean" } }).values;
    expect(() => requireConfirm(ok, "x", "do it")).not.toThrow();
  });
});

describe("truncation", () => {
  it("caps text with a size hint and keeps short text intact", () => {
    expect(truncateText("short", 10).value).toBe("short");
    const long = truncateText("x".repeat(50), 10);
    expect(long.truncated).toBe(true);
    expect(long.value).toContain("(truncated, 50 chars total");
  });

  it("snippets list rows without inline hints", () => {
    expect(snippet("abcdefgh", 5)).toBe("abcde\u2026");
    expect(snippet(undefined, 5)).toBeUndefined();
  });

  it("deep-truncates nested entity strings and counts fields", () => {
    const entity = { id: "f1", name: "y".repeat(500), fields: [{ label: "Email", answer: "z".repeat(500) }] };
    const result = truncateStringsDeep(entity, 100);
    const out = result.value as typeof entity;
    expect(out.id).toBe("f1");
    expect(String(out.name)).toContain("(truncated");
    expect(String((out.fields[0] as Record<string, unknown>)["answer"])).toContain("(truncated");
    expect(result.truncatedFields).toBe(2);
  });
});

describe("toAxiError boundary", () => {
  it("maps TallyError codes with status and retry hints, redacted", () => {
    const secret = "tally_super_secret_value_123456";
    const error = toAxiError(new TallyError("RATE_LIMITED", `slow down (key ${secret})`, 429, undefined, 5000)) as AxiError;
    expect(error).toBeInstanceOf(AxiError);
    expect(error.code).toBe("RATE_LIMITED");
    expect(error.message).not.toContain(secret);
    expect(error.suggestions).toEqual(expect.arrayContaining([expect.stringContaining("HTTP 429"), expect.stringContaining("Retry after 5s")]));
  });

  it("adds auth and not-found guidance", () => {
    const auth = toAxiError(new TallyError("AUTHENTICATION_FAILED", "nope", 401)) as AxiError;
    expect(auth.suggestions.join(" ")).toContain("TALLY_API_KEY");
    const missing = toAxiError(new TallyError("NOT_FOUND", "gone", 404)) as AxiError;
    expect(missing.suggestions.join(" ")).toContain("forms list");
  });

  it("passes non-Tally errors through untouched", () => {
    const raw = new Error("boom");
    expect(toAxiError(raw)).toBe(raw);
  });
});
