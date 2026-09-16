export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly details?: unknown) { super(message); }
}

export class TallyClient {
  constructor(private readonly apiKey: string, private readonly baseUrl = "https://api.tally.so") {}

  async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const response = await fetch(new URL(path, this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`), {
      method,
      headers: { Authorization: `Bearer ${this.apiKey}`, Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    let payload: unknown = null;
    if (text) { try { payload = JSON.parse(text); } catch { payload = { message: text }; } }
    if (!response.ok) throw new ApiError("Tally API request failed", response.status, payload);
    return payload;
  }
}
