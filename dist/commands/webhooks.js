import { AxiError } from "axi-sdk-js";
import { forbidExtraPositionals, oneOf, parseFlags, requireConfirm, requireHttpsUrl, requirePositional, requireString, } from "../lib/args.js";
import { asString, compact } from "../lib/fields.js";
import { ensureApiKey } from "../lib/env.js";
import { renderResult } from "../lib/output.js";
import { snippet } from "../lib/truncate.js";
export const WEBHOOKS_HELP = `tally-axi webhooks - FORM_RESPONSE callbacks for Tally forms

subcommands:
  webhooks list <formId>                 webhooks configured on one form
  webhooks create <formId> --url <url>   subscribe an endpoint (--confirm)
  webhooks delete <webhookId>            unsubscribe an endpoint (--confirm)

list flags:
  --json                 machine-readable JSON instead of TOON

create flags:
  --url <url>            required; must be https - Tally sends submission
                         data to this endpoint
  --event <name>         FORM_RESPONSE (default and only supported event)
  --confirm              required to create
  --json                 machine-readable JSON instead of TOON

delete flags:
  --confirm              required; the endpoint stops receiving events
  --json                 machine-readable JSON instead of TOON

examples:
  tally-axi webhooks list frmAbC123
  tally-axi webhooks create frmAbC123 --url https://example.com/hooks/tally --confirm
  tally-axi webhooks delete whkDel456 --confirm`;
const LIST_FLAGS = {
    json: { type: "boolean" },
};
const CREATE_FLAGS = {
    url: { type: "string" },
    event: { type: "string" },
    confirm: { type: "boolean" },
    json: { type: "boolean" },
};
const DELETE_FLAGS = {
    confirm: { type: "boolean" },
    json: { type: "boolean" },
};
const EVENTS = ["FORM_RESPONSE"];
export async function webhooksCommand(args, ctx) {
    const sub = args[0];
    const rest = args.slice(1);
    switch (sub) {
        case "list":
            return webhooksList(rest, ctx);
        case "create":
            return webhooksCreate(rest, ctx);
        case "delete":
            return webhooksDelete(rest, ctx);
        case undefined:
        case "--help":
        case "help":
            return { help_text: WEBHOOKS_HELP };
        default:
            throw new AxiError(`unknown webhooks subcommand: ${sub}`, "VALIDATION_ERROR", [
                "Run `tally-axi webhooks --help` to see list, create, delete",
            ]);
    }
}
async function webhooksList(args, ctx) {
    const commandPath = "tally-axi webhooks list";
    const { values, positionals } = parseFlags(args, commandPath, LIST_FLAGS);
    const formId = requirePositional(positionals, 0, "formId", commandPath);
    forbidExtraPositionals(positionals, 1, commandPath);
    const json = values["json"] === true;
    ensureApiKey(ctx.config, commandPath);
    const webhooks = await ctx.client.listWebhooks(formId);
    const rows = webhooks.map((webhook) => compact({
        id: asString(webhook.id),
        url: snippet(asString(webhook.url), 100),
        event: asString(webhook.event),
    }));
    const out = {
        form: formId,
        count: rows.length,
        webhooks: rows,
    };
    const help = [];
    if (rows.length === 0) {
        out["result"] = "0 webhooks \u2014 this form has no callbacks configured";
        help.push("Run `tally-axi webhooks create " + formId + " --url <https-url> --confirm` to add one");
    }
    else {
        help.push("Run `tally-axi webhooks delete <webhookId> --confirm` to remove one");
    }
    out["help"] = help;
    return renderResult(out, json);
}
async function webhooksCreate(args, ctx) {
    const commandPath = "tally-axi webhooks create";
    const { values, positionals } = parseFlags(args, commandPath, CREATE_FLAGS);
    const formId = requirePositional(positionals, 0, "formId", commandPath);
    forbidExtraPositionals(positionals, 1, commandPath);
    const json = values["json"] === true;
    const url = requireHttpsUrl(requireString(values, "url", commandPath) ?? "", "--url");
    const event = oneOf(values, "event", EVENTS) ?? "FORM_RESPONSE";
    ensureApiKey(ctx.config, commandPath);
    requireConfirm(values, commandPath, `send all ${formId} responses to ${url}`);
    const webhook = await ctx.client.createWebhook({ formId, url, event });
    return renderResult({
        webhook: compact({
            id: asString(webhook.id),
            url: snippet(asString(webhook.url), 100),
            event: asString(webhook.event),
        }),
        help: [
            "Tally now POSTs each new response to this endpoint",
            `Run \`tally-axi webhooks list ${formId}\` to see it registered`,
        ],
    }, json);
}
async function webhooksDelete(args, ctx) {
    const commandPath = "tally-axi webhooks delete";
    const { values, positionals } = parseFlags(args, commandPath, DELETE_FLAGS);
    const webhookId = requirePositional(positionals, 0, "webhookId", commandPath);
    forbidExtraPositionals(positionals, 1, commandPath);
    const json = values["json"] === true;
    ensureApiKey(ctx.config, commandPath);
    requireConfirm(values, commandPath, `unsubscribe webhook ${webhookId} (permanent)`);
    const result = await ctx.client.deleteWebhook(webhookId);
    return renderResult({
        deleted: compact({ id: result.id }),
        help: ["Run `tally-axi forms list` to pick another form to inspect"],
    }, json);
}
