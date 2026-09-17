import { describe, expect, it } from "vitest";
import { TallyApiAdapter } from "../src/tally/api.js";
import { TallyHttpClient } from "../src/tally/http.js";
import { TallyError } from "../src/tally/errors.js";

const SYNTHETIC_TEST_API_KEY = "tally_test_synthetic_key_not_valid_00000000";

const json = (value: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" }, ...init });

interface Recorded {
  url: string;
  options: RequestInit;
}

function mockApi(responses: Array<unknown | ((url: string, options: RequestInit) => unknown)>) {
  const calls: Recorded[] = [];
  const fetch: typeof fetch = async (url, options) => {
    calls.push({ url: String(url), options: options ?? {} });
    const next = responses.shift();
    return (typeof next === "function" ? next(String(url), options ?? {}) : next) as Response;
  };
  const sleep = async () => {};
  return { api: new TallyApiAdapter(SYNTHETIC_TEST_API_KEY, { fetch, sleep }), calls };
}

describe("TallyApiAdapter", () => {
  it("contracts every public API operation and normalizes output", async () => {
    const { api, calls } = mockApi([
      json({ items: [{ id: "f1", name: "Form" }], page: 2, limit: 1, total: 3 }),
      json({ id: "f1", name: "Form" }),
      json({ data: [{ id: "s1" }], page: 1, limit: 10, hasMore: false }),
      json({ id: "s1", fields: [{ label: "Email", value: "kept only for explicit get" }] }),
      new Response(null, { status: 204 }),
      json({ items: [{ id: "w1" }] }),
      json({ id: "w2", url: "https://example.com/hook" }),
      new Response(null, { status: 204 }),
    ]);
    expect(await api.listForms({ page: 2, limit: 1 })).toEqual({
      items: [{ id: "f1", name: "Form" }],
      page: 2,
      limit: 1,
      hasMore: true,
      total: 3,
    });
    expect((await api.getForm("f1")).id).toBe("f1");
    expect((await api.listSubmissions("f1", { limit: 10 })).items[0]?.id).toBe("s1");
    expect((await api.getSubmission("f1", "s1")).id).toBe("s1");
    expect(await api.deleteSubmission("f1", "s1")).toEqual({ deleted: true, id: "s1" });
    expect((await api.listWebhooks("f1"))[0]?.id).toBe("w1");
    expect(await api.createWebhook({ formId: "f1", url: "https://example.com/hook" })).toMatchObject({ id: "w2" });
    expect(await api.deleteWebhook("w2")).toEqual({ deleted: true, id: "w2" });
    expect(calls.map((x) => [x.options.method, new URL(x.url).pathname])).toEqual([
      ["GET", "/forms"],
      ["GET", "/forms/f1"],
      ["GET", "/forms/f1/submissions"],
      ["GET", "/forms/f1/submissions/s1"],
      ["DELETE", "/forms/f1/submissions/s1"],
      ["GET", "/forms/f1/webhooks"],
      ["POST", "/forms/f1/webhooks"],
      ["DELETE", "/webhooks/w2"],
    ]);
    expect(calls.every((x) => !JSON.stringify(x).includes("response-headers"))).toBe(true);
  });

  it("sends the bearer token and page query parameters", async () => {
    const { api, calls } = mockApi([json({ items: [], page: 1, limit: 5, total: 0 })]);
    await api.listForms({ page: 3, limit: 5 });
    const headers = new Headers(calls[0]?.options.headers as HeadersInit);
    expect(headers.get("authorization")).toBe(`Bearer ${SYNTHETIC_TEST_API_KEY}`);
    expect(calls[0]?.url).toContain("/forms?page=3&limit=5");
  });

  it("maps upstream status codes to structured errors", async () => {
    const { api } = mockApi([new Response(null, { status: 401 }), json({ message: "nope" }, { status: 404 })]);
    await expect(api.listForms()).rejects.toMatchObject({ code: "AUTHENTICATION_FAILED", status: 401 });
    await expect(api.getForm("missing")).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });

  it("rejects malformed success responses as MALFORMED_RESPONSE", async () => {
    const { api } = mockApi([json({ unexpected: true }), json({ id: "" }), json({ items: "not-an-array" })]);
    await expect(api.listForms()).rejects.toMatchObject({ code: "MALFORMED_RESPONSE" });
    await expect(api.getForm("f1")).rejects.toMatchObject({ code: "MALFORMED_RESPONSE" });
    await expect(api.listSubmissions("f1")).rejects.toMatchObject({ code: "MALFORMED_RESPONSE" });
  });

  it("redacts the configured token from upstream diagnostic bodies", async () => {
    const { api } = mockApi([
      json({ message: `bad key ${SYNTHETIC_TEST_API_KEY}`, authorization: "Bearer whatever" }, { status: 400 }),
    ]);
    const error = await api.listForms().catch((e: TallyError) => e);
    const text = JSON.stringify(error.details);
    expect(text).not.toContain(SYNTHETIC_TEST_API_KEY);
    expect(text).toContain("[REDACTED]");
  });

  it("retries safe reads on 429 and honors Retry-After, never retries writes", async () => {
    const calls: Recorded[] = [];
    const fetch: typeof fetch = async (url, options) => {
      calls.push({ url: String(url), options: options ?? {} });
      if (calls.length === 1) return new Response(null, { status: 429, headers: { "retry-after": "0" } });
      if (options?.method === "DELETE") return new Response(null, { status: 500 });
      return json({ items: [], page: 1, limit: 0, hasMore: false });
    };
    const api = new TallyApiAdapter(SYNTHETIC_TEST_API_KEY, { fetch, sleep: async () => {} });
    await api.listForms();
    expect(calls).toHaveLength(2); // one retry after the 429
    expect(calls.every((call) => new URL(call.url).pathname === "/forms")).toBe(true);
    await expect(api.deleteSubmission("f1", "s1")).rejects.toMatchObject({ code: "TRANSIENT_FAILURE" });
    expect(calls).toHaveLength(3); // the failed write was not retried
  });

  it("times out requests as TIMEOUT", async () => {
    const calls: Recorded[] = [];
    const fetch: typeof fetch = async (url, options) => {
      calls.push({ url: String(url), options: options ?? {} });
      return await new Promise((_resolve, reject) => {
        const signal = (options ?? {})["signal"] as AbortSignal | undefined;
        signal?.addEventListener("abort", () => {
          const abort = new Error("aborted");
          abort.name = "AbortError";
          reject(abort);
        });
      });
    };
    const client = new TallyHttpClient(SYNTHETIC_TEST_API_KEY, { fetch, timeoutMs: 20, maxRetries: 0 });
    await expect(client.request("GET", "forms")).rejects.toMatchObject({ code: "TIMEOUT" });
  });
});
