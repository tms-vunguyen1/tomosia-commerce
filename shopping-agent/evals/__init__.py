"""The shopping agent's eval suite: cases (``cases/*.json``, shape in the commerce-evals
skill), a live runner (``runner.py``) that records outcomes (``recordings/*.json``), code
scorers and a rubric judge (``scorers.py``, ``judge.py``), and a no-API replay gate for CI
(``replay.py``) against ``baseline.json``. The backend every case runs against is a
fixture (``fixtures.py``) seeded with real catalog ids — see its module docstring for why.
"""
