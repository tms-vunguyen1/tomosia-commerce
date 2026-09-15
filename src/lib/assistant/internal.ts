/**
 * The guard and helpers every route under `src/app/api/internal/assistant/` uses.
 *
 * These routes are the shopping assistant's view of the storefront: they are called by
 * the agent service, server to server, never by a browser. Two credentials travel on
 * them, both as headers and neither ever in a URL or a log line: the shared secret that
 * says the caller is the agent, and — on the routes that read an account — the Shopify
 * customer access token the agent holds for the session it is serving.
 */

import { getSinglePage } from "@/lib/contentParser";
import { NextRequest, NextResponse } from "next/server";
import { ErrorCode } from "./errors";
import { requireEnv } from "./service";
import type { AgentPolicy } from "./shapes";

export const INTERNAL_HEADER = "x-internal-token";
export const CUSTOMER_HEADER = "x-customer-token";

/** A response to send when the caller isn't the agent, or null when it is. */
export function refuseUnlessInternal(
  request: NextRequest,
): NextResponse | null {
  let expected: string;
  try {
    expected = requireEnv("ASSISTANT_INTERNAL_TOKEN");
  } catch {
    return NextResponse.json(
      { error: { code: ErrorCode.CONFIG_MISSING } },
      { status: 503 },
    );
  }
  if (request.headers.get(INTERNAL_HEADER) !== expected) {
    return NextResponse.json(
      { error: { code: ErrorCode.UNKNOWN_CALLER } },
      { status: 401 },
    );
  }
  return null;
}

/** The customer access token for this request, or null on a guest session. */
export function customerToken(request: NextRequest): string | null {
  return request.headers.get(CUSTOMER_HEADER) || null;
}

const MAX_POLICY_CHARS = 2400;
const MAX_MATCHES = 3;
/** The content folders whose pages answer a policy question. */
const POLICY_FOLDERS = ["pages", "sections"];

/** Markdown decoration the model does not need: link syntax, emphasis, shortcodes. */
function plainText(body: string): string {
  return body
    .replace(/\{\{<[^>]*>\}\}/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#>]+/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function loadPolicies(): AgentPolicy[] {
  const policies: AgentPolicy[] = [];
  for (const folder of POLICY_FOLDERS) {
    for (const page of getSinglePage(folder)) {
      const content = plainText(page.content ?? "");
      if (!content) continue;
      policies.push({
        policy_id: `${folder}/${page.slug}`,
        title: page.frontmatter?.title || page.slug,
        category: folder,
        content: content.slice(0, MAX_POLICY_CHARS),
      });
    }
  }
  return policies;
}

/**
 * The store's help pages matching a question, best first. A title hit counts triple: a
 * page named "Terms of Service" answers a question about terms better than one that
 * mentions the word once. The storefront's markdown is the store's only help content,
 * so this is what the agent quotes.
 */
export function searchPolicies(query: string): AgentPolicy[] {
  const policies = loadPolicies();
  const terms = query
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((term) => term.length > 2);
  if (!terms?.length) return policies.slice(0, MAX_MATCHES);

  const occurrences = (text: string, term: string) =>
    text.split(term).length - 1;

  return policies
    .map((policy) => {
      const title = policy.title.toLowerCase();
      const body = policy.content.toLowerCase();
      const score = terms.reduce(
        (sum, term) =>
          sum + 3 * occurrences(title, term) + occurrences(body, term),
        0,
      );
      return { policy, score };
    })
    .filter((scored) => scored.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_MATCHES)
    .map((scored) => scored.policy);
}
