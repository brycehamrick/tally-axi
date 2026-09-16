import type { JsonSchema } from "./tools.js";

export class InputError extends Error {
  constructor(message: string, public readonly details?: unknown) { super(message); }
}

export function validate(schema: JsonSchema, value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new InputError("Input must be a JSON object");
  const input = value as Record<string, unknown>;
  const properties = schema.properties as Record<string, JsonSchema>;
  const required = (schema.required as string[] | undefined) ?? [];
  const errors: string[] = [];
  for (const key of required) if (input[key] === undefined) errors.push(`${key} is required`);
  for (const key of Object.keys(input)) {
    const rule = properties[key];
    if (!rule) { errors.push(`${key} is not supported`); continue; }
    const current = input[key];
    if (rule.type === "string") {
      if (typeof current !== "string") errors.push(`${key} must be a string`);
      else if ((rule.minLength as number | undefined) && current.length < (rule.minLength as number)) errors.push(`${key} is too short`);
      else if ((rule.maxLength as number | undefined) && current.length > (rule.maxLength as number)) errors.push(`${key} is too long`);
      else if (rule.pattern && !(new RegExp(rule.pattern as string)).test(current)) errors.push(`${key} has an invalid format`);
      else if (rule.format === "uri") { try { const url = new URL(current); if (url.protocol !== "https:") errors.push(`${key} must use HTTPS`); } catch { errors.push(`${key} must be a valid URL`); } }
      if (rule.enum && !(rule.enum as string[]).includes(current as string)) errors.push(`${key} has an unsupported value`);
    } else if (rule.type === "number") {
      if (typeof current !== "number" || !Number.isInteger(current)) errors.push(`${key} must be an integer`);
      else if (current < (rule.minimum as number)) errors.push(`${key} is below the minimum`);
      else if (current > (rule.maximum as number)) errors.push(`${key} exceeds the maximum`);
    }
  }
  if (errors.length) throw new InputError("Invalid tool input", { errors });
  return input;
}
