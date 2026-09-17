import { AxiError } from "axi-sdk-js";
import { forbidExtraPositionals, optionalInt, parseFlags, requirePositional } from "../lib/args.js";
import { asString, compact } from "../lib/fields.js";
import { ensureApiKey } from "../lib/env.js";
import { pageCountLine, renderResult } from "../lib/output.js";
import { truncateStringsDeep, truncationHint } from "../lib/truncate.js";
export const FORMS_HELP = `tally-axi forms - forms shared with the authenticated Tally account

subcommands:
  forms list                     forms visible to the API key
  forms get <formId>             one form definition (truncated by default)

list flags:
  --limit <n>            1-100, default 25
  --page <n>             1-based page number
  --json                 machine-readable JSON instead of TOON

get flags:
  --full                 complete definition, no truncation
  --json                 machine-readable JSON instead of TOON

Tally form creation and editing are not in the public API - create and edit
forms at https://tally.so, then read them here.

examples:
  tally-axi forms list --limit 10
  tally-axi forms get frmAbC123 --full`;
const LIST_FLAGS = {
    limit: { type: "string" },
    page: { type: "string" },
    json: { type: "boolean" },
};
const GET_FLAGS = {
    full: { type: "boolean" },
    json: { type: "boolean" },
};
export async function formsCommand(args, ctx) {
    const sub = args[0];
    const rest = args.slice(1);
    switch (sub) {
        case "list":
            return formsList(rest, ctx);
        case "get":
            return formsGet(rest, ctx);
        case undefined:
        case "--help":
        case "help":
            return { help_text: FORMS_HELP };
        default:
            throw new AxiError(`unknown forms subcommand: ${sub}`, "VALIDATION_ERROR", [
                "Run `tally-axi forms --help` to see list, get",
            ]);
    }
}
async function formsList(args, ctx) {
    const commandPath = "tally-axi forms list";
    const { values } = parseFlags(args, commandPath, LIST_FLAGS);
    const limit = optionalInt(values, "limit", { min: 1, max: 100 }) ?? 25;
    const page = optionalInt(values, "page", { min: 1, max: 100_000 }) ?? 1;
    const json = values["json"] === true;
    ensureApiKey(ctx.config, commandPath);
    const result = await ctx.client.listForms({ page, limit });
    const rows = result.items.map((form) => compact({
        id: asString(form.id),
        name: asString(form.name),
        status: asString(form.status),
    }));
    const out = {
        count: rows.length,
        ...(result.total === undefined ? {} : { totalCount: result.total }),
        forms: rows,
    };
    const help = [];
    if (rows.length === 0) {
        out["result"] = "0 forms \u2014 nothing is shared with this API key";
        help.push("Create or share a form at https://tally.so, then rerun `tally-axi forms list`");
    }
    else {
        const firstId = asString(result.items[0]?.id);
        if (firstId)
            help.push(`Run \`tally-axi forms get ${firstId}\` for the form definition`);
        help.push("Run `tally-axi submissions list <formId>` for responses to a form");
    }
    const paging = pageCountLine(rows.length, result.total, page, limit);
    if (paging)
        help.push(paging);
    out["help"] = help;
    return renderResult(out, json);
}
async function formsGet(args, ctx) {
    const commandPath = "tally-axi forms get";
    const { values, positionals } = parseFlags(args, commandPath, GET_FLAGS);
    const formId = requirePositional(positionals, 0, "formId", commandPath);
    forbidExtraPositionals(positionals, 1, commandPath);
    const json = values["json"] === true;
    const full = values["full"] === true;
    ensureApiKey(ctx.config, commandPath);
    const form = await ctx.client.getForm(formId);
    const help = [
        `Run \`tally-axi submissions list ${formId}\` for its responses`,
        ...(full ? [] : ["Rerun with --full for the complete definition"]),
    ];
    if (full) {
        return renderResult({ form, help }, json);
    }
    const detail = truncateStringsDeep(form, 400);
    return renderResult({ form: detail.value, help: [...help, ...truncationHint(detail.truncatedFields, commandPath)] }, json);
}
