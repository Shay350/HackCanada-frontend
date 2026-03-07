from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class UptimeStatus(str, Enum):
    down = "down"
    degraded = "degraded"


class LogSnippet(BaseModel):
    timestamp: datetime
    source: str = Field(min_length=1, max_length=400)
    line: str = Field(min_length=1, max_length=20000)


class AnalysisJobCreate(BaseModel):
    incident_id: str = Field(min_length=1, max_length=200)
    service_name: str = Field(min_length=1, max_length=200)
    device_or_node: str = Field(min_length=1, max_length=200)
    uptime_status: UptimeStatus
    uptime_description: str = Field(min_length=1, max_length=4000)
    detected_at: datetime
    log_snippets: list[LogSnippet] = Field(default_factory=list, max_length=1000)
    metadata: dict[str, Any] = Field(default_factory=dict)
    idempotency_key: str | None = Field(default=None, min_length=1, max_length=200)


class JobCreatedResponse(BaseModel):
    job_id: UUID
    status: str


class JobStatusResponse(BaseModel):
    job_id: UUID
    status: str
    progress: int
    error: str | None
    created_at: datetime
    updated_at: datetime


class Hypothesis(BaseModel):
    hypothesis: str
    confidence: float = Field(ge=0, le=1)
    evidence_refs: list[str] = Field(default_factory=list)


class EvidenceItem(BaseModel):
    type: str
    source: str
    snippet: str
    timestamp: datetime | None = None


class CodeContextItem(BaseModel):
    file_path: str
    line_start: int
    line_end: int
    excerpt: str


class SuggestedAction(BaseModel):
    title: str
    description: str
    suggested_command: str
    safety_note: str


class ModelInfo(BaseModel):
    provider: str
    model_name: str
    latency_ms: int
    token_usage: dict[str, int] = Field(default_factory=dict)


class AnalysisReport(BaseModel):
    model_config = ConfigDict(extra="forbid")

    incident_id: str
    status: str
    root_cause_hypotheses: list[Hypothesis]
    evidence: list[EvidenceItem]
    code_context: list[CodeContextItem]
    suggested_actions: list[SuggestedAction]
    summary_text: str
    model: ModelInfo
    fallback_reason: str | None = None


class SummaryResponse(BaseModel):
    incident_id: str
    summary_text: str
    confidence: float
