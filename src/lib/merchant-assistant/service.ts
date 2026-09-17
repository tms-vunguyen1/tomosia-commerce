/**
 * Where the merchant agent service is and how this app authenticates to it. Server only.
 * Mirrors src/lib/assistant/service.ts for the shopping agent.
 */

export const MERCHANT_SESSION_HEADER = "x-session-id";

export class MissingConfiguration extends Error {
  constructor(name: string) {
    super(`${name} is not set; see .env.example`);
    this.name = "MissingConfiguration";
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new MissingConfiguration(name);
  return value;
}

export function merchantAssistantUrl(path: string): string {
  return `${requireEnv("MERCHANT_ASSISTANT_API_URL").replace(/\/$/, "")}${path}`;
}

export function merchantInternalHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Internal-Token": requireEnv("MERCHANT_ASSISTANT_INTERNAL_TOKEN"),
  };
}
