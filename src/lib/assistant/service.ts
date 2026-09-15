/**
 * Where the agent service is and how this app authenticates to it. Server only.
 *
 * Both values are required. A default address or an absent secret would let a
 * misconfigured deployment run — talking to nothing, or leaving the internal routes
 * open — so a missing one throws and the route answers 503 with the variable's name.
 */

export const ASSISTANT_SESSION_HEADER = "x-session-id";

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

export function assistantUrl(path: string): string {
  return `${requireEnv("ASSISTANT_API_URL").replace(/\/$/, "")}${path}`;
}

export function internalHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Internal-Token": requireEnv("ASSISTANT_INTERNAL_TOKEN"),
  };
}
