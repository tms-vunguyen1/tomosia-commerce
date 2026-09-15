"""The live executor (commerce-evals skill, Step 2.1): one fresh ``EvalStorefront`` and
``ShoppingAgent`` per trial, driven through a case's turns against the real Anthropic
API, recorded to ``recordings/<case_id>.json``. Cases run concurrently
(``--concurrency``); a case whose trial raises is reported and its recording left
untouched, never overwritten with a partial result. A ``rubric`` case is judged
(``judge.py``) once per trial, live, right here — replay (``replay.py``) reuses that
verdict rather than asking again.

    python -m evals.runner                        # every case in cases/
    python -m evals.runner search-002-budget-constraint cart-003-add-with-quantity
    python -m evals.runner --concurrency 2
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import Any

import anthropic
from shopping_agent import Product
from shopping_agent_runtime import ShoppingAgent

from evals import judge, scorers
from evals.fixtures import CUSTOMER_TOKEN, PRODUCTS, EvalStorefront
from shopping_assistant.backend import ShopifyStorefront
from shopping_assistant.config import build_config
from shopping_assistant.executor import ShoppingAssistantExecutor
from shopping_assistant.host import load_env
from shopping_assistant.storefront import StorefrontAPI
from shopping_assistant.types import AssistantSession, AssistantSessionState

EVALS_DIR = Path(__file__).resolve().parent
CASES_DIR = EVALS_DIR / "cases"
RECORDINGS_DIR = EVALS_DIR / "recordings"
SKILLS_DIR = EVALS_DIR.parent / "shopping_assistant" / "skills"

DEFAULT_CONCURRENCY = 4


def load_cases(ids: list[str] | None = None) -> list[dict[str, Any]]:
    cases = []
    for path in sorted(CASES_DIR.glob("*.json")):
        case = json.loads(path.read_text())
        if ids and case["id"] not in ids:
            continue
        cases.append(case)
    return cases


def _build_session_and_state(case: dict[str, Any]) -> tuple[AssistantSession, AssistantSessionState]:
    state_spec = case.get("state", {})
    session = AssistantSession(
        session_id=f"eval-{case['id']}",
        user_id=f"eval-user-{case['id']}",
        cart_id=f"eval-cart-{case['id']}",
        customer_access_token=CUSTOMER_TOKEN if state_spec.get("signed_in") else None,
    )
    state = AssistantSessionState()
    for product_id in state_spec.get("seen_products", []):
        state.seen_products[product_id] = Product(**PRODUCTS[product_id])
    return session, state


async def run_case_trial(case: dict[str, Any], client: anthropic.AsyncAnthropic) -> dict[str, Any]:
    storefront = EvalStorefront()
    backend = ShopifyStorefront(
        api=StorefrontAPI("http://eval.test", internal_token="eval", transport=storefront.transport)
    )
    agent = ShoppingAgent(
        backend=backend,
        skills_dir=SKILLS_DIR,
        config=build_config(),
        executor_class=ShoppingAssistantExecutor,
        client=client,
    )
    session, state = _build_session_and_state(case)

    messages: list[dict[str, Any]] = []
    events: list[dict[str, Any]] = []
    replies: list[str] = []
    try:
        for turn_index, turn_text in enumerate(case["turns"]):
            messages.append({"role": "user", "content": turn_text})
            turn_reply: list[str] = []
            async for event in agent.stream_turn(messages, session, state):
                record = event.model_dump()
                record["turn"] = turn_index
                events.append(record)
                if event.type == "text_delta":
                    turn_reply.append(event.data.get("text", ""))
            replies.append("".join(turn_reply))
    finally:
        await backend.aclose()

    final_cart = next(
        (e["data"]["cart"] for e in reversed(events) if e["type"] == "cart_update"),
        {"items": [], "currency": "USD"},
    )
    trial: dict[str, Any] = {
        "events": events,
        "replies": replies,
        "reply_text": "\n".join(replies),
        "final_cart": final_cart,
    }
    if "rubric" in case.get("expected", {}):
        trial["judge"] = await judge.judge_rubric(client, case, trial)
    return trial


async def run_case(
    case: dict[str, Any], client: anthropic.AsyncAnthropic, semaphore: asyncio.Semaphore
) -> dict[str, Any] | None:
    trials: list[dict[str, Any]] = []
    async with semaphore:
        for trial_index in range(case.get("trials", 1)):
            try:
                trials.append(await run_case_trial(case, client))
            except Exception as error:
                print(
                    f"  [{case['id']}] trial {trial_index + 1} errored, recording left "
                    f"untouched: {error!r}",
                    file=sys.stderr,
                )
                return None
    return {"case_id": case["id"], "trials": trials}


def report(case: dict[str, Any], trials: list[dict[str, Any]]) -> bool:
    trial_results = [scorers.score_trial(case, t) for t in trials]
    failed = scorers.aggregate_case(case, trial_results)
    ok = not any(failed.values())
    print(f"[{'PASS' if ok else 'FAIL'}] {case['id']}")
    for scorer_name, is_failed in failed.items():
        if not is_failed:
            continue
        passed = sum(1 for r in trial_results if r.get(scorer_name))
        print(f"    FAIL {scorer_name} ({passed}/{len(trials)} trials passed)")
        if scorer_name == "rubric":
            for trial in trials:
                verdict = trial.get("judge")
                if verdict:
                    print(f"      judge: {verdict['verdict']} — {verdict['reason']}")
    return ok


async def main_async(args: argparse.Namespace) -> int:
    load_env()
    client = anthropic.AsyncAnthropic(max_retries=5)
    cases = load_cases(args.case_ids or None)
    if not cases:
        print("no matching cases", file=sys.stderr)
        return 1

    semaphore = asyncio.Semaphore(args.concurrency)
    results = await asyncio.gather(*(run_case(case, client, semaphore) for case in cases))

    RECORDINGS_DIR.mkdir(exist_ok=True)
    all_ok = True
    for case, result in zip(cases, results, strict=True):
        if result is None:
            all_ok = False
            continue
        (RECORDINGS_DIR / f"{case['id']}.json").write_text(json.dumps(result, indent=2))
        all_ok = report(case, result["trials"]) and all_ok
    return 0 if all_ok else 1


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "case_ids", nargs="*", help="Case ids to run; every case in evals/cases/ if omitted."
    )
    parser.add_argument("--concurrency", type=int, default=DEFAULT_CONCURRENCY)
    args = parser.parse_args()
    sys.exit(asyncio.run(main_async(args)))


if __name__ == "__main__":
    main()
