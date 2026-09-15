"""CI's gate (commerce-evals skill, Step 2.4): re-score every stored recording with the
current ``scorers.py``, no API access. A ``rubric`` scorer reuses the verdict
``judge.py`` already recorded live in ``runner.py``; replay does not call the judge
again. The baseline is keyed by case and scorer, so a case that starts failing a
different scorer than the one baseline knows about is a new failure. A case with no
recording yet is reported pending, not passed — it should not silently count as green.

    python -m evals.replay
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from evals import scorers
from evals.runner import RECORDINGS_DIR, load_cases

BASELINE_PATH = Path(__file__).resolve().parent / "baseline.json"


def load_baseline() -> dict[str, list[str]]:
    if not BASELINE_PATH.exists():
        return {}
    return json.loads(BASELINE_PATH.read_text())


def main() -> int:
    baseline = load_baseline()
    cases = load_cases()
    pending: list[str] = []
    new_failures: list[str] = []

    for case in cases:
        recording_path = RECORDINGS_DIR / f"{case['id']}.json"
        if not recording_path.exists():
            pending.append(case["id"])
            print(f"[PENDING] {case['id']} — no recording yet")
            continue

        recording = json.loads(recording_path.read_text())
        trial_results = [scorers.score_trial(case, trial) for trial in recording["trials"]]
        failed = scorers.aggregate_case(case, trial_results)
        baselined = set(baseline.get(case["id"], []))

        failing = [scorer for scorer, is_failed in failed.items() if is_failed]
        if not failing:
            print(f"[PASS] {case['id']}")
            continue
        for scorer_name in failing:
            if scorer_name in baselined:
                print(f"[FAIL] {case['id']} :: {scorer_name} (baselined)")
            else:
                print(f"[FAIL] {case['id']} :: {scorer_name} (NEW)")
                new_failures.append(f"{case['id']}:{scorer_name}")

    if pending:
        print(f"\n{len(pending)} case(s) pending (no recording): {', '.join(pending)}")
    if new_failures:
        print(f"\n{len(new_failures)} new failure(s): {', '.join(new_failures)}")
        return 1
    print("\nno new failures")
    return 0


if __name__ == "__main__":
    sys.exit(main())
