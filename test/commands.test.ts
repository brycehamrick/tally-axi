import { describe, expect, it } from "vitest";
import { AxiError } from "axi-sdk-js";
import type { CommandContext } from "../src/context.js";
import type { TallyConfig } from "../src/lib/env.js";
import type { TallyOperations } from "../src/tally/models.js";
import { TallyError } from "../src/tally/errors.js";
import { homeCommand } from "../src/commands/home.js";
import { formsCommand } from "../src/commands/forms.js";
import { submissionsCommand } from "../src/commands/submissions.js";
import { webhooksCommand } from "../src/commands/webhooks.js";

const CONFIG: TallyConfig = { apiKey: "tally_test_synthetic_key_not_valid_00000000", apiBaseUrl: "https://api.tally.so", timeoutMs: 10000 };
const KEYLESS: TallyConfig = { apiBaseUrl: "https://api.tally.so", timeoutMs: 10000 };

/** Fake TallyOperations that records calls; unexpected calls fail the test. */
function fakeClient(overrides: Partial<TallyOperations> = {}) {
  const calls: string[] = [];
  const unexpected = (name: string) => async () => {
    calls.push(name);
    throw new Error(`unexpected client call: ${name}`);
  };
  const client: TallyOperations = {
    listForms: unexpected("listForms"),
    getForm: unexpected("getForm"),
    listSubmissions: unexpected("listSubmissions"),
    getSubmission: unexpected("getSubmission"),
    deleteSubmission: unexpected("deleteSubmission"),
    listWebhooks: unexpected("listWebhooks"),
    createWebhook: unexpected("createWebhook"),
    deleteWebhook: unexpected("deleteWebhook"),
    ...Object.fromEntries(Object.entries(overrides).map(([name, impl]) => [name, (...args: unknown[]) => { calls.push(name); return (impl as (...a: unknown[]) => unknown)(...args); }])),
  };
  return { client: client as TallyOperations, calls };
}

const ctxFor = (client: TallyOperations, config: TallyConfig = CONFIG): CommandContext => ({ config, client });

const formsPage = (ids: string[], total?: number) => ({
  items: ids.map((id) => ({ id, name: `Form ${id}` })),
  page: 1,
  limit: ids.length,
  hasMore: false,
  ...(total === undefined ? {} : { total }),
});

describe("home view", () => {
  it("stays network-free and explains setup when no key is configured", async () => {
    const { client, calls } = fakeClient();
    const out = (await homeCommand([], ctxFor(client, KEYLESS))) as Record<string, unknown>;
    expect(calls).toEqual([]);
    expect(out["auth"]).toBe("not-configured");
    expect(String(out["setup"])).toContain("TALLY_API_KEY");
    expect(Array.isArray(out["help"])).toBe(true);
  });

  it("shows live form data when authenticated", async () => {
    const { client, calls } = fakeClient({ listForms: async () => formsPage(["f1", "f2"], 12) });
    const out = (await homeCommand([], ctxFor(client))) as Record<string, unknown>;
    expect(calls).toEqual(["listForms"]);
    expect(out["forms"]).toContain("12");
    expect(out["recent_forms"]).toHaveLength(2);
  });

  it("degrades gracefully when the auth check fails", async () => {
    const { client } = fakeClient({ listForms: async () => { throw new TallyError("AUTHENTICATION_FAILED", "rejected", 401); } });
    const out = (await homeCommand([], ctxFor(client))) as Record<string, unknown>;
    expect(String(out["forms"])).toContain("unknown");
    expect(out["help"]).toEqual(expect.arrayContaining([expect.stringContaining("forms list")]));
  });
});

describe("forms", () => {
  it("lists with minimal schema, totalCount, and next steps", async () => {
    const { client } = fakeClient({ listForms: async () => formsPage(["f1", "f2", "f3"], 50) });
    const out = (await formsCommand(["list", "--limit", "3"], ctxFor(client))) as Record<string, unknown>;
    expect(out["count"]).toBe(3);
    expect(out["totalCount"]).toBe(50);
    expect(out["forms"]).toEqual([
      { id: "f1", name: "Form f1" },
      { id: "f2", name: "Form f2" },
      { id: "f3", name: "Form f3" },
    ]);
    expect(out["help"]).toEqual(expect.arrayContaining([expect.stringContaining("of 50")]));
  });

  it("emits a definitive empty state for 0 forms", async () => {
    const { client } = fakeClient({ listForms: async () => formsPage([], 0) });
    const out = (await formsCommand(["list"], ctxFor(client))) as Record<string, unknown>;
    expect(String(out["result"])).toContain("0 forms");
  });

  it("rejects unknown flags as VALIDATION_ERROR (exit 2)", async () => {
    const { client } = fakeClient();
    await expect(formsCommand(["list", "--nope"], ctxFor(client))).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      suggestions: expect.arrayContaining([expect.stringContaining("--json")]),
    });
  });

  it("truncates long fields with size hints and restores with --full", async () => {
    const longName = "A".repeat(1000);
    const { client } = fakeClient({ getForm: async () => ({ id: "f1", name: longName }) });
    const out = (await formsCommand(["get", "f1"], ctxFor(client))) as Record<string, unknown>;
    const form = out["form"] as Record<string, unknown>;
    expect(String(form["name"])).toContain("(truncated, 1000 chars total");
    expect(out["help"]).toEqual(expect.arrayContaining([expect.stringContaining("--full")]));
    const full = (await formsCommand(["get", "f1", "--full"], ctxFor(client))) as Record<string, unknown>;
    expect((full["form"] as Record<string, unknown>)["name"]).toHaveLength(1000);
  });

  it("refuses to run without an API key before any network call", async () => {
    const { client, calls } = fakeClient();
    await expect(formsCommand(["list"], ctxFor(client, KEYLESS))).rejects.toMatchObject({ code: "CONFIGURATION_ERROR" });
    expect(calls).toEqual([]);
  });
});

describe("submissions", () => {
  it("lists submissions for a form with a pagination hint", async () => {
    const { client } = fakeClient({
      listSubmissions: async () => ({ items: [{ id: "s1", submittedAt: "2026-01-01T00:00:00Z" }], page: 1, limit: 25, hasMore: true, total: 40 }),
    });
    const out = (await submissionsCommand(["list", "f1"], ctxFor(client))) as Record<string, unknown>;
    expect(out["form"]).toBe("f1");
    expect(out["count"]).toBe(1);
    expect(out["totalCount"]).toBe(40);
    expect(out["help"]).toEqual(expect.arrayContaining([expect.stringContaining("--page 2")]));
  });

  it("gates delete behind --confirm with zero network calls and exit-2 error", async () => {
    const { client, calls } = fakeClient({ deleteSubmission: async () => ({ deleted: true as const, id: "s1" }) });
    await expect(submissionsCommand(["delete", "f1", "s1"], ctxFor(client))).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(calls).toEqual([]);
    const out = (await submissionsCommand(["delete", "f1", "s1", "--confirm"], ctxFor(client))) as Record<string, unknown>;
    expect(calls).toEqual(["deleteSubmission"]);
    expect(out["deleted"]).toEqual({ id: "s1", form: "f1" });
  });
});

describe("webhooks", () => {
  it("lists webhooks with minimal schema and empty state", async () => {
    const { client } = fakeClient({
      listWebhooks: async () => [{ id: "w1", url: "https://example.com/hook", event: "FORM_RESPONSE" }],
    });
    const out = (await webhooksCommand(["list", "f1"], ctxFor(client))) as Record<string, unknown>;
    expect(out["count"]).toBe(1);
    expect(out["webhooks"]).toEqual([{ id: "w1", url: "https://example.com/hook", event: "FORM_RESPONSE" }]);

    const empty = fakeClient({ listWebhooks: async () => [] });
    const none = (await webhooksCommand(["list", "f1"], ctxFor(empty.client))) as Record<string, unknown>;
    expect(String(none["result"])).toContain("0 webhooks");
  });

  it("requires an https --url and --confirm to create", async () => {
    const { client, calls } = fakeClient({ createWebhook: async () => ({ id: "w2", url: "https://example.com/hook", event: "FORM_RESPONSE" }) });
    await expect(webhooksCommand(["create", "f1", "--url", "http://example.com/hook", "--confirm"], ctxFor(client))).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    await expect(webhooksCommand(["create", "f1", "--url", "https://example.com/hook"], ctxFor(client))).rejects.toBeInstanceOf(AxiError);
    expect(calls).toEqual([]);
    const out = (await webhooksCommand(["create", "f1", "--url", "https://example.com/hook", "--confirm"], ctxFor(client))) as Record<string, unknown>;
    expect(calls).toEqual(["createWebhook"]);
    expect(out["webhook"]).toMatchObject({ id: "w2" });
  });

  it("gates delete behind --confirm", async () => {
    const { client, calls } = fakeClient({ deleteWebhook: async () => ({ deleted: true as const, id: "w1" }) });
    await expect(webhooksCommand(["delete", "w1"], ctxFor(client))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(calls).toEqual([]);
    await webhooksCommand(["delete", "w1", "--confirm"], ctxFor(client));
    expect(calls).toEqual(["deleteWebhook"]);
  });

  it("rejects unknown subcommands with a pointer to --help", async () => {
    const { client } = fakeClient();
    await expect(webhooksCommand(["rename"], ctxFor(client))).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      suggestions: expect.arrayContaining([expect.stringContaining("--help")]),
    });
  });
});
