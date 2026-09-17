import type { CommandContext } from "../context.js";
import type { AxiRenderable } from "../lib/output.js";

/**
 * AXI principles 7 and 8: the no-argument home view is live content, not
 * help. Keyless runs stay free of network calls so session-start hooks stay
 * fast and safe; authenticated runs make exactly one cheap call
 * (forms list, limit 5) and degrade gracefully when it fails.
 */
export async function homeCommand(_args: string[], ctx: CommandContext): Promise<AxiRenderable> {
  const authed = ctx.config.apiKey !== undefined;
  const out: Record<string, unknown> = {
    auth: authed ? "api-key" : "not-configured",
  };

  if (!authed) {
    out["setup"] = "export TALLY_API_KEY=<key from Tally settings> to read forms and submissions";
    out["commands"] = "forms submissions webhooks";
  } else {
    try {
      const page = await ctx.client.listForms({ page: 1, limit: 5 });
      out["forms"] =
        page.total === undefined ? `${page.items.length}+ shared with this key` : `${page.total} shared with this key`;
      out["recent_forms"] = page.items.map((form) => ({
        id: form.id,
        name: form.name ?? "(unnamed)",
        status: form.status ?? "unknown",
      }));
    } catch {
      out["forms"] = "unknown (auth check failed \u2014 run `tally-axi forms list`)";
    }
  }

  out["help"] = [
    "Run `tally-axi forms list` to see every form this key can read",
    "Run `tally-axi forms get <formId>` for one form definition",
    "Run `tally-axi submissions list <formId>` for responses to a form",
    "Run `tally-axi --help` or `<command> --help` for details",
    ...(authed ? [] : ["Run `tally-axi forms --help` to preview the command surface before configuring a key"]),
  ];
  return out;
}
