"""Derive sprint and team metrics from issue histories."""

from datetime import datetime, timedelta
from statistics import median


def instant(value):
    return datetime.fromisoformat(value)


def history_before(issue, cutoff):
    return [
        change for change in sorted(issue["statusChanges"], key=lambda row: instant(row["at"]))
        if instant(change["at"]) < cutoff
    ]


def status(issue, cutoff):
    history = history_before(issue, cutoff)
    return history[-1]["status"] if history else "To Do"


def cycle_days(issue, cutoff):
    history = history_before(issue, cutoff)
    if not history or history[-1]["status"] != "Done":
        return None
    started = next((instant(row["at"]) for row in history if row["status"] == "In Progress"), None)
    if started is None:
        return None
    # Include elapsed time across a reopen, through the last transition to Done.
    finished = instant(history[-1]["at"])
    return (finished - started).total_seconds() / 86_400


def ratio(numerator, denominator):
    return round(100 * numerator / denominator, 1) if denominator else 0.0


def rounded_median(values):
    return round(median(values), 1) if values else None


def sprint_metrics(sprint):
    start, end = instant(sprint["start"]), instant(sprint["end"])
    issues = [item for item in sprint["issues"] if instant(item["addedAt"]) < end]
    committed = [item for item in issues if instant(item["addedAt"]) <= start]
    done = [item for item in issues if status(item, end) == "Done"]
    cycles = [days for item in done if (days := cycle_days(item, end)) is not None]
    spillover = sum(status(item, end) != "Done" for item in committed)
    planned_points = sum(item["storyPoints"] for item in committed)
    days = (end - start).days
    burndown = []
    for day in range(days + 1):
        cutoff = start + timedelta(days=day)
        in_scope = committed if day == 0 else [
            item for item in issues if instant(item["addedAt"]) < cutoff
        ]
        burndown.append({
            "day": day, "date": cutoff.date().isoformat(),
            "remaining": sum(item["storyPoints"] for item in in_scope
                             if status(item, cutoff) != "Done"),
            "ideal": round(planned_points * (days - day) / days, 1) if days else 0,
        })
    return {
        "velocity": sum(item["storyPoints"] for item in done),
        "throughput": len(done), "cycleTimeDays": rounded_median(cycles),
        "spilloverRate": ratio(spillover, len(committed)),
        "spilloverCount": spillover, "committedCount": len(committed),
        "plannedPoints": planned_points,
        "addedPoints": sum(item["storyPoints"] for item in issues) - planned_points,
        "goalHit": sprint["goalHit"], "burndown": burndown,
    }, cycles


def team_metrics(team):
    summaries = []
    cycles = []
    goals = 0
    for sprint in team["sprints"]:
        metrics, samples = sprint_metrics(sprint)
        cycles.extend(samples)
        goals += metrics["goalHit"]
        keys = ("id", "name", "number", "start", "end", "goal")
        summaries.append({
            **{key: sprint[key] for key in keys},
            **{key: value for key, value in metrics.items() if key != "burndown"},
            "goalHitRate": ratio(goals, len(summaries) + 1),
        })
    count = len(summaries)

    def average(key):
        return round(sum(sprint[key] for sprint in summaries) / count, 1) if count else 0.0

    return {
        "team": {key: team[key] for key in ("id", "name", "focus")},
        "sprints": summaries,
        "metrics": {
            "velocity": average("velocity"), "throughput": average("throughput"),
            "cycleTimeDays": rounded_median(cycles),
            "spilloverRate": ratio(sum(s["spilloverCount"] for s in summaries),
                                   sum(s["committedCount"] for s in summaries)),
            "goalHitRate": ratio(goals, count),
        },
    }
