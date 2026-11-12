from fastapi import FastAPI, HTTPException

from lab.data import generate
from lab.metrics import instant, sprint_metrics, status, team_metrics
from lab.summary import MockSummaryModel, SummaryRequest, SummaryResponse, summarize

app = FastAPI(title="Sprintboard synthetic metrics")
data = generate()
teams = {team["id"]: team for team in data["teams"]}
model = MockSummaryModel()


def team_or_404(team_id):
    if team_id not in teams:
        raise HTTPException(404, "Team not found")
    return teams[team_id]


@app.get("/api/health")
def health():
    return {"status": "ok", "synthetic": True}


@app.get("/api/teams")
def list_teams():
    return [{"id": team["id"], "name": team["name"], "focus": team["focus"]}
            for team in teams.values()]


@app.get("/api/teams/{team_id}/sprints")
def overview(team_id: str):
    return team_metrics(team_or_404(team_id))


@app.get("/api/teams/{team_id}/sprints/{sprint_id}")
def detail(team_id: str, sprint_id: str):
    team = team_or_404(team_id)
    sprint = next((item for item in team["sprints"] if item["id"] == sprint_id), None)
    if sprint is None:
        raise HTTPException(404, "Sprint not found")
    metrics, _ = sprint_metrics(sprint)
    summary = next(s for s in team_metrics(team)["sprints"] if s["id"] == sprint_id)
    end = instant(sprint["end"])
    return {
        **sprint, "team": {"id": team["id"], "name": team["name"], "focus": team["focus"]},
        "metrics": {**metrics, "goalHitRate": summary["goalHitRate"]},
        "issues": [{**item, "statusAtClose": status(item, end)} for item in sprint["issues"]],
    }


@app.post("/api/summarize", response_model=SummaryResponse)
def summary(request: SummaryRequest):
    return summarize(request, model)
