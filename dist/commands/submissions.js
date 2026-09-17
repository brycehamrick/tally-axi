import { AxiError } from "axi-sdk-js";
import { forbidExtraPositionals, optionalInt, parseFlags, requireConfirm, requirePositional, } from "../lib/args.js";
import { asString, compact } from "../lib/fields.js";
import { ensureApiKey } from "../lib/env.js";
import { pageCountLine, renderResult } from "../lib/output.js";
import { truncateStringsDeep, truncationHint } from "../lib/truncate.js";
export const SUBMISSIONS_HELP = `tally-axi submissions - form responses collected by Tally

subcommands:
  submissions list <formId>                    responses for one form
  submissions get <formId> <submissionId>      one response (truncated by default)
  submissions delete <formId> <submissionId>   permanently delete (--confirm)

list flags:
  --limit <n>            1-100, default 25
  --page <n>             1-based page number
  --json                 machine-readable JSON instead of TOON

get flags:
  --full                 complete answers, no truncation
  --json                 machine-readable JSON instead of TOON

delete flags:
  --confirm              required; deletion is permanent and cannot be undone
  --json                 machine-readable JSON instead of TOON

examples:
  tally-axi submissions list frmAbC123 --limit 10
  tally-axi submissions get frmAbC123 subXyZ789 --full
  tally-axi submissions delete frmAbC123 subXyZ789 --confirm`;
const LIST_FLAGS = {
    limit: { type: "string" },
    page: { type: "string" },
    json: { type: "boolean" },
};
const GET_FLAGS = {
    full: { type: "boolean" },
    json: { type: "boolean" },
};
const DELETE_FLAGS = {
    confirm: { type: "boolean" },
    json: { type: "boolean" },
};
export async function submissionsCommand(args, ctx) {
    const sub = args[0];
    const rest = args.slice(1);
    switch (sub) {
        case "list":
            return submissionsList(rest, ctx);
        case "get":
            return submissionsGet(rest, ctx);
        case "delete":
            return submissionsDelete(rest, ctx);
        case undefined:
        case "--help":
        case "help":
            return { help_text: SUBMISSIONS_HELP };
        default:
            throw new AxiError(`unknown submissions subcommand: ${sub}`, "VALIDATION_ERROR", [
                "Run `tally-axi submissions --help` to see list, get, delete",
            ]);
    }
}
async function submissionsList(args, ctx) {
    const commandPath = "tally-axi submissions list";
    const { values, positionals } = parseFlags(args, commandPath, LIST_FLAGS);
    const formId = requirePositional(positionals, 0, "formId", commandPath);
    forbidExtraPositionals(positionals, 1, commandPath);
    const limit = optionalInt(values, "limit", { min: 1, max: 100 }) ?? 25;
    const page = optionalInt(values, "page", { min: 1, max: 100_000 }) ?? 1;
    const json = values["json"] === true;
    ensureApiKey(ctx.config, commandPath);
    const result = await ctx.client.listSubmissions(formId, { page, limit });
    const rows = result.items.map((submission) => compact({
        id: asString(submission.id),
        submitted: asString(submission.submittedAt),
    }));
    const out = {
        form: formId,
        count: rows.length,
        ...(result.total === undefined ? {} : { totalCount: result.total }),
        submissions: rows,
    };
    const help = [];
    if (rows.length === 0) {
        out["result"] = "0 submissions \u2014 this form has no responses yet";
        help.push("Run `tally-axi forms list` to confirm the form id");
    }
    else {
        const firstId = asString(result.items[0]?.id);
        if (firstId)
            help.push(`Run \`tally-axi submissions get ${formId} ${firstId}\` for the full answers`);
    }
    const paging = pageCountLine(rows.length, result.total, page, limit);
    if (paging)
        help.push(paging);
    out["help"] = help;
    return renderResult(out, json);
}
async function submissionsGet(args, ctx) {
    const commandPath = "tally-axi submissions get";
    const { values, positionals } = parseFlags(args, commandPath, GET_FLAGS);
    const formId = requirePositional(positionals, 0, "formId", commandPath);
    const submissionId = requirePositional(positionals, 1, "submissionId", commandPath);
    forbidExtraPositionals(positionals, 2, commandPath);
    const json = values["json"] === true;
    const full = values["full"] === true;
    ensureApiKey(ctx.config, commandPath);
    const submission = await ctx.client.getSubmission(formId, submissionId);
    const help = [
        `Run \`tally-axi submissions list ${formId}\` for its siblings`,
        ...(full ? [] : ["Rerun with --full for the complete answers"]),
    ];
    if (full) {
        return renderResult({ submission, help }, json);
    }
    const detail = truncateStringsDeep(submission, 400);
    return renderResult({ submission: detail.value, help: [...help, ...truncationHint(detail.truncatedFields, commandPath)] }, json);
}
async function submissionsDelete(args, ctx) {
    const commandPath = "tally-axi submissions delete";
    const { values, positionals } = parseFlags(args, commandPath, DELETE_FLAGS);
    const formId = requirePositional(positionals, 0, "formId", commandPath);
    const submissionId = requirePositional(positionals, 1, "submissionId", commandPath);
    forbidExtraPositionals(positionals, 2, commandPath);
    const json = values["json"] === true;
    ensureApiKey(ctx.config, commandPath);
    requireConfirm(values, commandPath, `permanently delete submission ${submissionId} of form ${formId}`);
    const result = await ctx.client.deleteSubmission(formId, submissionId);
    return renderResult({
        deleted: compact({ id: result.id, form: formId }),
        help: [`Run \`tally-axi submissions list ${formId}\` to confirm the remaining set`],
    }, json);
}
