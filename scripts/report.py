"""Render observed Linux test counts and evaluation numbers for the run summary."""

import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

REPORTS = Path("reports")
SUITES = {"pytest": "Pytest", "vitest": "Vitest", "playwright": "Playwright"}
lines = ["| Suite | Passed | Failed | Skipped |", "| --- | ---: | ---: | ---: |"]
errors = []
passed_total = 0
count_total = 0

for filename, label in SUITES.items():
    path = REPORTS / f"{filename}.xml"
    if not path.exists():
        errors.append(f"Missing {filename}.xml.")
        continue
    tests = ET.parse(path).findall(".//testcase")
    failures = sum(case.find("failure") is not None or case.find("error") is not None
                   for case in tests)
    skipped = sum(case.find("skipped") is not None for case in tests)
    passed = len(tests) - failures - skipped
    lines.append(f"| {label} | {passed} | {failures} | {skipped} |")
    count_total += len(tests)
    passed_total += passed
    if not tests or failures or skipped:
        errors.append(f"{label} did not report a fully passing suite.")
    if filename == "playwright" and passed < 10:
        errors.append("Fewer than 10 Playwright tests passed.")

evaluation = REPORTS / "ai-evaluation.json"
if evaluation.exists():
    result = json.loads(evaluation.read_text(encoding="utf-8"))
    lines.extend([
        "", f'Theme evaluation on **{result["samples"]} labeled samples**.',
        "",
        "| Metric | Observed |",
        "| --- | ---: |",
        f'| Micro precision | {result["precision"]:.2%} |',
        f'| Micro recall | {result["recall"]:.2%} |',
        "",
        f'{result["truePositives"]} true positives, {result["falsePositives"]} false positives, '
        f'and {result["falseNegatives"]} false negatives.',
    ])
else:
    errors.append("Missing ai-evaluation.json.")

if errors:
    lines.extend(["", *[f"- {error}" for error in errors]])
lines.insert(0, f"**{passed_total}/{count_total} tests passed.**\n")
(REPORTS / "summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
sys.exit(bool(errors))
