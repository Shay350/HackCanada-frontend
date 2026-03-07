from __future__ import annotations

import hashlib
from datetime import datetime
from enum import Enum
from typing import Any, Literal
from urllib.parse import urlparse
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


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


class UptimeKumaJobCreate(BaseModel):
    monitor: str = Field(min_length=1, max_length=200)
    status: str = Field(min_length=1, max_length=40)
    msg: str = Field(min_length=1, max_length=4000)
    url: str = Field(min_length=1, max_length=2000)
    time: datetime
    log_snippets: list[LogSnippet] = Field(default_factory=list, max_length=1000)
    metadata: dict[str, Any] = Field(default_factory=dict)
    idempotency_key: str | None = Field(default=None, min_length=1, max_length=200)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {UptimeStatus.down.value, UptimeStatus.degraded.value}:
            raise ValueError("status must be DOWN/down or DEGRADED/degraded for triage jobs")
        return normalized

    def to_internal(self) -> AnalysisJobCreate:
        node = (
            self.metadata.get("device_or_node")
            or self.metadata.get("node")
            or self._node_from_url(self.url)
            or "unknown-node"
        )
        incident_id = self._incident_id()
        return AnalysisJobCreate(
            incident_id=incident_id,
            service_name=self.monitor,
            device_or_node=str(node),
            uptime_status=UptimeStatus(self.status),
            uptime_description=self.msg,
            detected_at=self.time,
            log_snippets=self.log_snippets,
            metadata=self.metadata,
            idempotency_key=self.idempotency_key,
        )

    def _incident_id(self) -> str:
        base = f"{self.monitor}|{self.time.isoformat()}|{self.status}"
        digest = hashlib.sha1(base.encode("utf-8")).hexdigest()[:12]
        slug = "".join(ch if ch.isalnum() else "-" for ch in self.monitor.lower()).strip("-")
        slug = slug[:40] or "monitor"
        return f"inc-{slug}-{digest}"

    def _node_from_url(self, value: str) -> str | None:
        parsed = urlparse(value)
        return parsed.hostname


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


class ProposedFixView(BaseModel):
    description: str
    steps: list[str]


class IncidentView(BaseModel):
    id: str
    service: str
    serviceType: str
    status: Literal["online", "issue", "warning", "resolving"]
    logs: list[str]
    confidence: float = Field(ge=0, le=1)
    proposedFix: ProposedFixView | None = None


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
