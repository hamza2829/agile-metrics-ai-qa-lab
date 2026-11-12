from copy import deepcopy

import pytest
from fastapi.testclient import TestClient

from lab.app import app
from lab.data import generate
from lab.metrics import sprint_metrics, team_metrics

client = TestClient(app)
START = "2026-01-05T00:00:00Z"
END = "2026-01-19T00:00:00Z"


def issue(key, points, progress=None, done=None, added=START, kind="Story"):
    history = [{"at": added, "status": "To Do"}]
    if progress:
        history.append({"at": f"2026-01-{progress:02d}T00:00:00Z", "status": "In Progress"})
    if done:
        history.append({"at": f"2026-01-{done:02d}T00:00:00Z", "status": "Done"})
    return {"key": key, "storyPoints": points, "addedAt": added,
            "statusChanges": history, "issueType": kind}


@pytest.fixture
def example():
    return {
        "id": "sprint-01", "name": "Sprint 01", "number": 1, "start": START, "end": END,
        "goal": "Complete A", "goalHit": True,
        "issues": [
            issue("A", 5, progress=6, done=8),
            issue("B", 3, progress=6),
            issue("C", 2, progress=10, done=13, added="2026-01-09T00:00:00Z"),
            issue("D", 0, progress=7, done=8, kind="Bug"),
        ],
    }


def test_velocity_counts_completed_story_points_including_added_scope(example):
    metrics, _ = sprint_metrics(example)
    assert metrics["velocity"] == 5 + 2
    assert metrics["plannedPoints"] == 5 + 3
    assert metrics["addedPoints"] == 2


def test_throughput_counts_completed_bug_as_one_item(example):
    assert sprint_metrics(example)[0]["throughput"] == 3


def test_median_cycle_time_uses_elapsed_calendar_days(example):
    metrics, cycles = sprint_metrics(example)
    assert sorted(cycles) == [1, 2, 3]
    assert metrics["cycleTimeDays"] == 2


def test_spillover_denominator_excludes_late_scope(example):
    metrics, _ = sprint_metrics(example)
    assert metrics["spilloverCount"] == 1
    assert metrics["committedCount"] == 3
    assert metrics["spilloverRate"] == 33.3


def test_burndown_rises_after_scope_is_added(example):
    days = sprint_metrics(example)[0]["burndown"]
    assert len(days) == 15
    assert [days[i]["remaining"] for i in [0, 3, 4, 5, 14]] == [8, 8, 3, 5, 3]
    assert [days[i]["ideal"] for i in [0, 7, 14]] == [8, 4, 0]


def test_end_is_exclusive_for_completion(example):
    example["issues"][1]["statusChanges"].append({"at": END, "status": "Done"})
    metrics, _ = sprint_metrics(example)
    assert metrics["velocity"] == 7
    assert metrics["spilloverCount"] == 1


def test_reopen_counts_elapsed_time_to_final_done(example):
    example["issues"][0]["statusChanges"].extend([
        {"at": "2026-01-09T00:00:00Z", "status": "In Progress"},
        {"at": "2026-01-10T00:00:00Z", "status": "Done"},
    ])
    metrics, cycles = sprint_metrics(example)
    assert sorted(cycles) == [1, 3, 4]
    assert metrics["cycleTimeDays"] == 3


def test_done_without_progress_counts_throughput_without_cycle_sample(example):
    example["issues"] = [issue("A", 5, done=8)]
    metrics, cycles = sprint_metrics(example)
    assert metrics["velocity"] == 5
    assert metrics["throughput"] == 1
    assert metrics["cycleTimeDays"] is None
    assert cycles == []


def test_empty_sprint_has_no_cycle_sample_or_spillover(example):
    example["issues"] = []
    metrics, _ = sprint_metrics(example)
    assert metrics["throughput"] == 0
    assert metrics["cycleTimeDays"] is None
    assert metrics["spilloverRate"] == 0
    assert all(day["remaining"] == 0 for day in metrics["burndown"])


def test_team_metrics_aggregate_and_track_cumulative_goal_hit_rate(example):
    second = deepcopy(example)
    second.update(id="sprint-02", name="Sprint 02", number=2, issues=[], goalHit=False)
    result = team_metrics({"id": "demo", "name": "Demo", "focus": "Testing",
                           "sprints": [example, second]})
    assert result["metrics"] == {"velocity": 3.5, "throughput": 1.5, "cycleTimeDays": 2,
                                 "spilloverRate": 33.3, "goalHitRate": 50}
    assert [sprint["goalHitRate"] for sprint in result["sprints"]] == [100, 50]


def test_generator_is_repeatable_and_seed_affects_issues():
    assert generate(21) == generate(21)
    assert generate(21) != generate(22)


def test_fixture_has_three_teams_and_twelve_sprints_each():
    fixture = generate()
    assert fixture["synthetic"] is True
    assert [team["name"] for team in fixture["teams"]] == ["Atlas", "Beacon", "Cedar"]
    assert all(len(team["sprints"]) == 12 for team in fixture["teams"])


def test_scope_creep_and_slow_team_are_visible_in_metrics():
    atlas, beacon, cedar = generate()["teams"]
    assert sprint_metrics(atlas["sprints"][5])[0]["addedPoints"] == 15
    assert team_metrics(cedar)["metrics"]["cycleTimeDays"] > (
        team_metrics(beacon)["metrics"]["cycleTimeDays"]
    )


def test_carried_story_retains_key_points_and_history():
    team = generate()["teams"][0]
    previous, current = team["sprints"][2:4]
    carried = next(row for row in current["issues"] if row["carryoverFrom"])
    original = next(row for row in previous["issues"] if row["key"] == carried["key"])
    assert carried["carryoverFrom"] == previous["id"]
    assert carried["storyPoints"] == original["storyPoints"]
    assert carried["statusChanges"][:-1] == original["statusChanges"]
    assert carried["statusChanges"][-1]["status"] == "Done"


def test_health_identifies_synthetic_fixture():
    assert client.get("/api/health").json() == {"status": "ok", "synthetic": True}


def test_overview_and_detail_agree_on_sprint_metrics():
    overview = client.get("/api/teams/atlas/sprints").json()
    detail = client.get("/api/teams/atlas/sprints/sprint-06").json()
    row = overview["sprints"][5]
    assert row["id"] == detail["id"]
    assert row["velocity"] == detail["metrics"]["velocity"]
    assert row["goalHitRate"] == detail["metrics"]["goalHitRate"]
    assert detail["issues"][0]["statusAtClose"] in {"To Do", "In Progress", "Done"}


@pytest.mark.parametrize("path", [
    "/api/teams/missing/sprints",
    "/api/teams/atlas/sprints/sprint-13",
])
def test_missing_team_or_sprint_returns_404(path):
    assert client.get(path).status_code == 404
