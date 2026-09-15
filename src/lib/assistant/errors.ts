/** Error codes the assistant's routes answer with, and the English text they resolve to.
 * Mirrors `shopping-agent/shopping_assistant/errors.py`. A second language is a new table keyed
 * by the same codes; nothing that produces an error needs to change. */

export const ErrorCode = {
  UNKNOWN_CALLER: "UNKNOWN_CALLER",
  CART_PROVENANCE_HELD: "CART_PROVENANCE_HELD",
  CART_OPTIONS_HELD: "CART_OPTIONS_HELD",
  CART_PRODUCT_NOT_SHOWN: "CART_PRODUCT_NOT_SHOWN",
  CART_ADD_FAILED: "CART_ADD_FAILED",
  CHAT_AUTH_FAILED: "CHAT_AUTH_FAILED",
  CHAT_FAILED: "CHAT_FAILED",
  PRODUCT_NOT_FOUND: "PRODUCT_NOT_FOUND",
  // No HTTP response to carry these: the agent itself couldn't be reached.
  CONFIG_MISSING: "CONFIG_MISSING",
  ASSISTANT_UNREACHABLE: "ASSISTANT_UNREACHABLE",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ApiError {
  code: string;
  /** CART_ADD_FAILED's `reason`, English, from the shared tool executor. */
  params?: Record<string, string>;
}

const EN: Record<string, (params?: Record<string, string>) => string> = {
  [ErrorCode.UNKNOWN_CALLER]: () => "The assistant refused this request.",
  [ErrorCode.CART_PROVENANCE_HELD]: () =>
    "That product did not come from this conversation's results.",
  [ErrorCode.CART_OPTIONS_HELD]: () =>
    "Choose the product's options with the assistant before adding it.",
  [ErrorCode.CART_PRODUCT_NOT_SHOWN]: () =>
    "That product isn't in this conversation's results.",
  [ErrorCode.CART_ADD_FAILED]: (params) =>
    params?.reason || "That could not be added.",
  [ErrorCode.CHAT_AUTH_FAILED]: () =>
    "The assistant isn't configured correctly. Please try again later.",
  [ErrorCode.CHAT_FAILED]: () => "Something went wrong. Please try again.",
  [ErrorCode.PRODUCT_NOT_FOUND]: () => "That product is no longer listed.",
  [ErrorCode.CONFIG_MISSING]: () =>
    "The shopping assistant isn't configured yet.",
  [ErrorCode.ASSISTANT_UNREACHABLE]: () =>
    "The shopping assistant is unavailable right now.",
};

const FALLBACK = "Something went wrong. Please try again.";

/** Display text for an error code, in English. An unrecognized code falls back to one
 * generic line instead of surfacing raw JSON. */
export function resolveError(error: ApiError | string): string {
  const code = typeof error === "string" ? error : error.code;
  const params = typeof error === "string" ? undefined : error.params;
  return EN[code]?.(params) ?? FALLBACK;
}

/** Reads `{"error": {"code", "params"}}` from a parsed response body, or null. */
export function parseApiError(body: unknown): ApiError | null {
  const error = (body as { error?: unknown } | null)?.error;
  if (
    !error ||
    typeof error !== "object" ||
    typeof (error as ApiError).code !== "string"
  ) {
    return null;
  }
  return error as ApiError;
}
