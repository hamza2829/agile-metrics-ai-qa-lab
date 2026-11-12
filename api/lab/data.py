"""Generate a repeatable synthetic Jira-style fixture."""

import argparse
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from random import Random

DEFAULT_SEED = 2026
START = datetime(2026, 1, 5, tzinfo=UTC)
TEAMS = (
    ("atlas", "Atlas", "ATL", "Customer experience", 1),
    ("beacon", "Beacon", "BCN", "Platform reliability", 2),
    ("cedar", "Cedar", "CDR", "Internal operations", 5),
)
TITLES = (
    "Improve search results", "Simplify notification preferences", "Add a reporting filter",
    "Improve the activity timeline", "Update the onboarding checklist", "Add export controls",
    "Show clearer validation messages", "Reduce duplicate support requests",
    "Add a summary card", "Refine the settings navigation",
)


def iso(instant):
    return instant.isoformat().replace("+00:00", "Z")


def retro(team, number):
    if team == "atlas" and number == 6:
        return {
            "wentWell": ["Pairing helped us deliver the first goal story."],
            "toImprove": [
                "Scope creep from three mid-sprint requests disrupted the sprint goal.",
                "Code review took two days on the late changes.",
            ],
            "actions": [
                {"id": "a1", "text": "Review new requests before adding them to a sprint.",
                 "owner": "Maya Chen"},
                {"id": "a2", "text": "Reserve a daily code review slot.", "owner": "Sam Lee"},
            ],
        }
    if team == "beacon" and number == 4:
        return {"wentWell": [], "toImprove": [], "actions": []}
    if team == "cedar":
        return {
            "wentWell": ["Pairing helped us share context on the goal stories."],
            "toImprove": [
                "An upstream dependency blocked our first story.",
                "Code review took longer than we planned.",
            ],
            "actions": [
                {"id": "a1", "text": "Ask the platform team for an owner before planning.",
                 "owner": "Alex Rivera"},
                {"id": "a2", "text": "Reserve a daily code review slot.", "owner": "Jamie Park"},
            ],
        }
    return {
        "wentWell": ["Pairing helped us share context on the goal stories."],
        "toImprove": [
            "Flaky tests made the CI pipeline hard to trust.",
            "Sprint planning missed an upstream dependency.",
        ],
        "actions": [
            {"id": "a1", "text": "Quarantine and investigate the flaky tests.",
             "owner": "Jordan Taylor"},
            {"id": "a2", "text": "Confirm dependencies before sprint planning.",
             "owner": "Ari Bell"},
        ],
    }


def make_issue(key, title, points, kind, start, offset, duration, sprint_id, previous):
    history = list(previous["statusChanges"]) if previous else []
    if not previous:
        history.extend([
            {"at": iso(start), "status": "To Do"},
            {"at": iso(start + timedelta(days=offset, hours=9)), "status": "In Progress"},
        ])
    if offset + duration < 14:
        history.append({
            "at": iso(start + timedelta(days=offset + duration, hours=15)), "status": "Done",
        })
    return {
        "key": key, "summary": title, "issueType": kind, "storyPoints": points,
        "addedAt": iso(start if previous else start + timedelta(days=max(0, offset - 5))),
        "statusChanges": history, "carryoverFrom": sprint_id if previous else None,
    }


def generate(seed=DEFAULT_SEED):
    rng = Random(seed)
    teams = []
    for team_id, name, prefix, focus, delay in TEAMS:
        sprints = []
        carry = None
        for number in range(1, 13):
            sprint_id = f"sprint-{number:02d}"
            start = START + timedelta(days=(number - 1) * 14)
            end = start + timedelta(days=14)
            issues = []
            if carry:
                issues.append(make_issue(
                    carry["key"], carry["summary"], carry["storyPoints"], "Story", start,
                    0, delay + 1, sprints[-1]["id"], carry,
                ))
            stories = []
            for i in range(rng.randint(4, 6)):
                offset = i + rng.randint(0, 2)
                duration = delay + rng.randint(1, 5)
                if i == 0 and (number in {3, 8} or team_id == "cedar" and number % 3 == 0):
                    duration = 15
                story = make_issue(
                    f"{prefix}-{number * 100 + i + 1}", rng.choice(TITLES),
                    rng.choice([2, 3, 5, 5, 8]), "Story", start, offset, duration, None, None,
                )
                story["addedAt"] = iso(start)
                stories.append(story)
            issues.extend(stories)
            issues.append(make_issue(
                f"{prefix}-{number * 100 + 90}", "Fix duplicate status notification", 0,
                "Bug", start, 2, delay + 1, None, None,
            ))
            if team_id == "atlas" and number == 6:
                for i in range(3):
                    issues.append(make_issue(
                        f"{prefix}-{number * 100 + 70 + i}", f"Unplanned request {i + 1}", 5,
                        "Story", start, 9 + i, 2 + i, None, None,
                    ))
            goal_keys = [item["key"] for item in stories[:2]]
            goal_hit = all(item["statusChanges"][-1]["status"] == "Done" for item in stories[:2])
            carry = next((item for item in stories if
                          item["statusChanges"][-1]["status"] != "Done"), None)
            sprints.append({
                "id": sprint_id, "name": f"Sprint {number:02d}", "number": number,
                "start": iso(start), "end": iso(end),
                "goal": f"{stories[0]['summary']} and complete a supporting story.",
                "goalIssueKeys": goal_keys, "goalHit": goal_hit, "issues": issues,
                "retrospective": retro(team_id, number),
            })
        teams.append({"id": team_id, "name": name, "focus": focus, "sprints": sprints})
    return {"seed": seed, "synthetic": True, "teams": teams}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    data = json.dumps(generate(args.seed), ensure_ascii=False, indent=2) + "\n"
    if args.out:
        args.out.write_text(data, encoding="utf-8")
    else:
        print(data, end="")
