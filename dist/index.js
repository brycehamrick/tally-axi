import { runAxiCli, AxiError } from "axi-sdk-js";
import { redact } from "./lib/redact.js";
import { VERSION } from "./version.js";
import { getCommandContext } from "./context.js";
import { homeCommand } from "./commands/home.js";
import { formsCommand, FORMS_HELP } from "./commands/forms.js";
import { submissionsCommand, SUBMISSIONS_HELP } from "./commands/submissions.js";
import { webhooksCommand, WEBHOOKS_HELP } from "./commands/webhooks.js";
import { TallyError } from "./tally/errors.js";
export const DESCRIPTION = "Tally forms, submissions, and webhooks for agents - token-efficient reads over the Tally REST API";
const TOP_LEVEL_HELP = `tally-axi - ${DESCRIPTION}

commands:
  forms list                  forms shared with the API key
  forms get <formId>          one form definition (truncated; --full)
  submissions list <formId>   responses for one form
  submissions get <formId> <submissionId>
                              one response (truncated; --full)
  submissions delete <formId> <submissionId>
                              permanently delete (--confirm)
  webhooks list <formId>      webhooks configured on one form
  webhooks create <formId> --url <https-url>
                              new FORM_RESPONSE webhook (--confirm)
  webhooks delete <webhookId> unsubscribe an endpoint (--confirm)

global flags: --help, -v/--version, update (self-update)

auth: TALLY_API_KEY env var (required for data commands; the home view and
--help work without one). Optional TALLY_API_BASE_URL and TALLY_TIMEOUT_MS
override the endpoint (https://api.tally.so) and the 10s timeout.

run \`tally-axi <command> --help\` for a command reference.`;
const COMMAND_HELP = {
    forms: { help: FORMS_HELP },
    submissions: { help: SUBMISSIONS_HELP },
    webhooks: { help: WEBHOOKS_HELP },
};
/**
 * Structured errors on stdout (AXI principle 6): transport-level TallyError
 * becomes an AxiError carrying its code plus HTTP status and Retry-After
 * hints, so the SDK owns all error rendering and exit codes
 * (VALIDATION_ERROR = 2, everything else = 1).
 */
export function toAxiError(error) {
    if (!(error instanceof TallyError))
        return error;
    const suggestions = [];
    if (error.status !== undefined)
        suggestions.push(`Tally responded with HTTP ${error.status}`);
    if (error.retryAfterMs !== undefined && error.retryAfterMs > 0)
        suggestions.push(`Retry after ${Math.ceil(error.retryAfterMs / 1000)}s`);
    if (error.code === "AUTHENTICATION_FAILED")
        suggestions.push("Create or rotate the key in Tally settings, then update TALLY_API_KEY");
    if (error.code === "NOT_FOUND")
        suggestions.push("Run `tally-axi forms list` to confirm the id");
    const detail = error.details === undefined ? "" : ` (${redact(JSON.stringify(error.details)).slice(0, 300)})`;
    return new AxiError(redact(`${error.message}${detail}`), error.code, suggestions);
}
function withContext(command) {
    return async (args) => {
        try {
            return await command(args, getCommandContext());
        }
        catch (error) {
            throw toAxiError(error);
        }
    };
}
export async function main() {
    await runAxiCli({
        description: DESCRIPTION,
        version: VERSION,
        topLevelHelp: TOP_LEVEL_HELP,
        getCommandHelp: (command) => COMMAND_HELP[command]?.help ?? null,
        home: withContext(homeCommand),
        commands: {
            forms: withContext(formsCommand),
            submissions: withContext(submissionsCommand),
            webhooks: withContext(webhooksCommand),
        },
    });
}
// Direct execution (node dist/index.js) instead of the bin wrapper.
if (process.argv[1]?.endsWith("index.js")) {
    await main();
}
