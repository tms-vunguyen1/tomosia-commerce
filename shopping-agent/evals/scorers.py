"""One function per ``expected`` key, run over a recorded trial (the flat event list and
final cart a live turn produced — see ``runner.run_case_trial``). Every key but
``rubric`` is a code grader here; ``rubric`` reads the verdict ``judge.py`` already
recorded on the trial, since replay re-scores with no API access.

``staged_change_kinds`` and ``no_applied_changes`` are merchant-only concepts (a
``change_update`` event never fires for this shopping agent) and ``memory_contains`` /
``memory_not_contains`` need a memory store this deployment does not have
(``enable_memory=False``); a case that names one of those keys is a case for the wrong
role or deployment, not something this module can score, so it raises rather than
silently passing.
"""

from __future__ import annotations

import math
from typing import Any

# present_suggestions ends a turn and isn't part of what the turn "did"; excluded from
# every tool-call-counting scorer per the commerce-evals skill's authoring rules.
_UNCOUNTED_TOOLS = {"present_suggestions"}


def _tool_calls(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [e for e in events if e["type"] == "tool_call"]


def _first_turn_tool_calls(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [e for e in _tool_calls(events) if e.get("turn") == 0]


def _tool_names(events: list[dict[str, Any]]) -> list[str]:
    return [e["data"]["tool"] for e in _tool_calls(events)]


def _reply_text(trial: dict[str, Any]) -> str:
    return str(trial.get("reply_text", ""))


def _last_cart(trial: dict[str, Any]) -> dict[str, Any]:
    return trial.get("final_cart") or {"items": [], "currency": "USD"}


def _cart_ids(trial: dict[str, Any]) -> set[str]:
    return {item["product_id"] for item in _last_cart(trial).get("items", [])}


def _cart_item_count(trial: dict[str, Any]) -> int:
    return sum(item["quantity"] for item in _last_cart(trial).get("items", []))


def _skill_loads(events: list[dict[str, Any]]) -> set[str]:
    return {
        e["data"]["input"]["skill_name"]
        for e in _tool_calls(events)
        if e["data"]["tool"] == "load_skill"
    }


def _ui_components(events: list[dict[str, Any]]) -> set[str]:
    return {e["data"]["component"] for e in events if e["type"] == "ui"}


UNSUPPORTED_KEYS = {
    "staged_change_kinds": "merchant-only: this shopping agent never emits change_update.",
    "no_applied_changes": "merchant-only: this shopping agent never emits change_update.",
    "memory_contains": "memory is off for this deployment (enable_memory=False).",
    "memory_not_contains": "memory is off for this deployment (enable_memory=False).",
}


def score_trial(case: dict[str, Any], trial: dict[str, Any]) -> dict[str, bool]:
    """``{expected_key: passed}`` for every key ``case["expected"]`` sets."""
    expected = case.get("expected", {})
    events = trial.get("events", [])
    results: dict[str, bool] = {}

    for key in expected:
        if key in UNSUPPORTED_KEYS:
            raise ValueError(f"{case['id']}: expected.{key} is unsupported here — {UNSUPPORTED_KEYS[key]}")

    if "calls_tool" in expected:
        names = set(_tool_names(events))
        results["calls_tool"] = set(expected["calls_tool"]).issubset(names)

    if "calls_one_of" in expected:
        names = set(_tool_names(events))
        results["calls_one_of"] = bool(names & set(expected["calls_one_of"]))

    if "never_calls" in expected:
        names = set(_tool_names(events))
        results["never_calls"] = names.isdisjoint(expected["never_calls"])

    if "first_tool" in expected:
        first = _first_turn_tool_calls(events)
        results["first_tool"] = bool(first) and first[0]["data"]["tool"] == expected["first_tool"]

    if "first_tool_not" in expected:
        first = _first_turn_tool_calls(events)
        results["first_tool_not"] = not first or first[0]["data"]["tool"] != expected["first_tool_not"]

    if "ui_components" in expected:
        results["ui_components"] = set(expected["ui_components"]).issubset(_ui_components(events))

    if "no_ui" in expected:
        results["no_ui"] = not any(e["type"] == "ui" for e in events)

    if "cart_contains" in expected:
        results["cart_contains"] = set(expected["cart_contains"]).issubset(_cart_ids(trial))

    if "cart_not_contains" in expected:
        results["cart_not_contains"] = _cart_ids(trial).isdisjoint(expected["cart_not_contains"])

    if "cart_item_count" in expected:
        results["cart_item_count"] = _cart_item_count(trial) == expected["cart_item_count"]

    if "skill_loaded" in expected:
        results["skill_loaded"] = expected["skill_loaded"] in _skill_loads(events)

    if "skill_not_loaded" in expected:
        results["skill_not_loaded"] = expected["skill_not_loaded"] not in _skill_loads(events)

    if "no_skill_load" in expected:
        results["no_skill_load"] = not _skill_loads(events)

    if "reply_includes" in expected:
        reply = _reply_text(trial).lower()
        results["reply_includes"] = all(s.lower() in reply for s in expected["reply_includes"])

    if "reply_omits" in expected:
        reply = _reply_text(trial).lower()
        results["reply_omits"] = all(s.lower() not in reply for s in expected["reply_omits"])

    if "max_tool_calls" in expected:
        counted = [n for n in _tool_names(events) if n not in _UNCOUNTED_TOOLS]
        results["max_tool_calls"] = len(counted) <= expected["max_tool_calls"]

    if "rubric" in expected:
        verdict = (trial.get("judge") or {}).get("verdict")
        results["rubric"] = verdict == "PASS"

    return results


def aggregate_case(case: dict[str, Any], trial_results: list[dict[str, bool]]) -> dict[str, bool]:
    """``{scorer: failed}`` across all of a case's trials, against its pass_threshold.

    A trial-count-based slack: with ``trials`` runs and a ``pass_threshold`` of how many
    must pass, a scorer is a failure for this run once it fails more times than the
    threshold allows to fail (``trials - pass_threshold``). trials=1 (the default) means
    zero slack: any single failure fails the case, same as before trials existed.
    """
    trials = case.get("trials", 1)
    pass_threshold = case.get("pass_threshold", math.ceil(trials / 2) if trials > 1 else 1)
    allowed_failures = trials - pass_threshold

    scorers = case.get("expected", {}).keys()
    failed: dict[str, bool] = {}
    for scorer in scorers:
        failures = sum(1 for r in trial_results if not r.get(scorer, False))
        failed[scorer] = failures > allowed_failures
    return failed
