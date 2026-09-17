import { TallyHttpClient } from "./http.js";
import { responseEntity, responsePage, responseWebhooks } from "./response.js";
const query = (request = {}) => {
    const q = new URLSearchParams();
    if (request.page)
        q.set("page", String(request.page));
    if (request.limit)
        q.set("limit", String(request.limit));
    return q.size ? `?${q}` : "";
};
const id = encodeURIComponent;
/** Typed adapter for the public Tally REST API (see developers.tally.so). */
export class TallyApiAdapter {
    http;
    constructor(token, options) {
        this.http = new TallyHttpClient(token, options);
    }
    async listForms(request = {}) {
        return responsePage(await this.http.request("GET", `forms${query(request)}`), request);
    }
    async getForm(formId) {
        return responseEntity(await this.http.request("GET", `forms/${id(formId)}`));
    }
    async listSubmissions(formId, request = {}) {
        return responsePage(await this.http.request("GET", `forms/${id(formId)}/submissions${query(request)}`), request);
    }
    async getSubmission(formId, submissionId) {
        return responseEntity(await this.http.request("GET", `forms/${id(formId)}/submissions/${id(submissionId)}`));
    }
    async deleteSubmission(formId, submissionId) {
        await this.http.request("DELETE", `forms/${id(formId)}/submissions/${id(submissionId)}`);
        return { deleted: true, id: submissionId };
    }
    async listWebhooks(formId) {
        return responseWebhooks(await this.http.request("GET", `forms/${id(formId)}/webhooks`));
    }
    async createWebhook(request) {
        return responseEntity(await this.http.request("POST", `forms/${id(request.formId)}/webhooks`, { url: request.url, event: request.event ?? "FORM_RESPONSE" }));
    }
    async deleteWebhook(webhookId) {
        await this.http.request("DELETE", `webhooks/${id(webhookId)}`);
        return { deleted: true, id: webhookId };
    }
}
