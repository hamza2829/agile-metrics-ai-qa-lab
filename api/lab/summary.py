"""A deterministic bilingual mock and a grounded response contract."""

import re
from typing import Annotated, Literal, Protocol

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

Theme = Literal["scope", "planning", "review", "ci", "quality", "collaboration", "dependencies"]
NoteKind = Literal["wentWell", "toImprove"]
ID = Annotated[str, StringConstraints(min_length=1, max_length=40, pattern=r"^[a-zA-Z0-9_-]+$")]
MAX_NOTE_LENGTH = 4000

LABELS: dict[Theme, str] = {
    "scope": "Scope changes",
    "planning": "Sprint planning",
    "review": "Code review",
    "ci": "CI stability",
    "quality": "Testing and quality",
    "collaboration": "Team collaboration",
    "dependencies": "Dependencies and blockers",
}

VOCABULARY: dict[Theme, str] = {
    "scope": r"scope creep|mid.sprint requests?|unplanned work|umfangsänderung|ungeplante arbeit",
    "planning": r"sprint planning|estimat\w*|capacity plan|sprintplanung|schätzung\w*",
    "review": r"code review\w*|pull requests?|review.warteschlange|codeprüfung",
    "ci": r"ci pipeline|builds? fail\w*|pipeline\w*|build.fehler",
    "quality": r"flaky tests?|test coverage|regression tests?|instabile tests?|testabdeckung",
    "collaboration": r"pairing|pair programming|handoffs?|zusammenarbeit|paarprogrammierung",
    "dependencies": r"dependenc\w*|block\w*|abhängigkeit\w*",
}
PATTERNS = {theme: re.compile(rf"\b(?:{terms})\b", re.IGNORECASE)
            for theme, terms in VOCABULARY.items()}
INSTRUCTIONS = re.compile(
    r"\b(?:ignore (?:all |any |the )?(?:previous |earlier |prior )?instructions|"
    r"ignore the rules|ignoriere .{0,45}anweisungen|"
    r"(?:add|invent|output) (?:an? |the )?action)\b|"
    r"\b(?:system|assistant|developer)\s*:",
    re.IGNORECASE,
)


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Note(StrictModel):
    id: ID
    kind: NoteKind
    text: Annotated[str, StringConstraints(max_length=MAX_NOTE_LENGTH)]


class Action(StrictModel):
    id: ID
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]
    owner: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class SummaryRequest(StrictModel):
    notes: list[Note] = Field(max_length=60)
    actions: list[Action] = Field(max_length=30)

    @model_validator(mode="after")
    def unique_ids(self):
        for group in (self.notes, self.actions):
            if len({entry.id for entry in group}) != len(group):
                raise ValueError("IDs must be unique within each list")
        return self


class ThemeEvidence(StrictModel):
    theme: Theme
    noteIds: list[ID] = Field(min_length=1, max_length=60)


class ThemeResult(ThemeEvidence):
    label: str


class SummaryResponse(StrictModel):
    mode: Literal["mock"] = "mock"
    themes: list[ThemeResult]
    suggestedActions: list[Action]


class SummaryModel(Protocol):
    def select(
        self, notes: list[Note], actions: list[Action],
    ) -> tuple[list[ThemeEvidence], list[str]]:
        """Return theme evidence and IDs of existing actions to surface."""


class MockSummaryModel:
    def select(
        self, notes: list[Note], actions: list[Action],
    ) -> tuple[list[ThemeEvidence], list[str]]:
        evidence: dict[Theme, list[str]] = {}
        for note in notes:
            clauses = re.split(r"[.!?;\n]+", note.text)
            safe_text = " ".join(clause for clause in clauses if not INSTRUCTIONS.search(clause))
            for theme, pattern in PATTERNS.items():
                if pattern.search(safe_text):
                    evidence.setdefault(theme, []).append(note.id)
        findings = [ThemeEvidence(theme=theme, noteIds=evidence[theme])
                    for theme in LABELS if theme in evidence]
        return findings, [action.id for action in actions[:3]]


def summarize(request: SummaryRequest, model: SummaryModel) -> SummaryResponse:
    usable = [note for note in request.notes if note.text.strip()]
    if not usable:
        return SummaryResponse(themes=[], suggestedActions=[])
    findings, action_ids = model.select(usable, request.actions)
    note_ids = {note.id for note in usable}
    evidence: dict[Theme, list[str]] = {}
    for finding in findings:
        matched = [note_id for note_id in finding.noteIds if note_id in note_ids]
        if matched:
            evidence.setdefault(finding.theme, []).extend(matched)
    by_id = {action.id: action for action in request.actions}
    return SummaryResponse(
        themes=[ThemeResult(theme=theme, label=LABELS[theme],
                            noteIds=list(dict.fromkeys(ids)))
                for theme, ids in evidence.items()],
        suggestedActions=[by_id[key] for key in dict.fromkeys(action_ids) if key in by_id][:3],
    )
