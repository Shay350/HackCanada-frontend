from __future__ import annotations

import re
from pathlib import Path

from analysis_agent.config import get_settings
from analysis_agent.schemas import AnalysisJobCreate, CodeContextItem

TEXT_EXTENSIONS = {
    ".py",
    ".js",
    ".ts",
    ".tsx",
    ".json",
    ".yaml",
    ".yml",
    ".toml",
    ".env",
    ".ini",
    ".sh",
    ".md",
}


class SelectiveCodeRetriever:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.read_roots = [root for root in self.settings.read_roots if root.exists()]

    def retrieve(self, payload: AnalysisJobCreate) -> list[CodeContextItem]:
        if not self.read_roots:
            return []

        keywords = self._extract_keywords(payload)
        if not keywords:
            return []

        scored: list[tuple[int, Path, str]] = []
        for file_path in self._iter_candidate_files():
            content = self._safe_read_text(file_path)
            if not content:
                continue
            score = self._score_text(file_path, content, keywords)
            if score <= 0:
                continue
            scored.append((score, file_path, content))

        scored.sort(key=lambda item: item[0], reverse=True)
        top_files = scored[: self.settings.max_context_files]
        results: list[CodeContextItem] = []

        for _, file_path, content in top_files:
            line_start, line_end, excerpt = self._build_excerpt(content, keywords)
            results.append(
                CodeContextItem(
                    file_path=str(file_path.relative_to(self.settings.project_root)),
                    line_start=line_start,
                    line_end=line_end,
                    excerpt=excerpt[: self.settings.max_context_excerpt_chars],
                )
            )

        return results

    def _extract_keywords(self, payload: AnalysisJobCreate) -> set[str]:
        tokens = [payload.service_name, payload.uptime_description, payload.device_or_node]
        tokens.extend(snippet.line for snippet in payload.log_snippets)
        joined = " ".join(tokens).lower()
        words = re.findall(r"[a-zA-Z0-9_./-]+", joined)
        return {word for word in words if len(word) >= 4}

    def _iter_candidate_files(self):
        for root in self.read_roots:
            for file_path in root.rglob("*"):
                if not file_path.is_file():
                    continue
                if file_path.suffix.lower() not in TEXT_EXTENSIONS:
                    continue
                if not self._is_path_allowed(file_path):
                    continue
                yield file_path

    def _is_path_allowed(self, path: Path) -> bool:
        resolved = path.resolve()
        for root in self.read_roots:
            if resolved == root or root in resolved.parents:
                return True
        return False

    def _safe_read_text(self, path: Path) -> str:
        try:
            return path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            return ""

    def _score_text(self, file_path: Path, content: str, keywords: set[str]) -> int:
        haystack = f"{file_path.name.lower()}\n{content.lower()}"
        return sum(haystack.count(keyword) for keyword in keywords)

    def _build_excerpt(self, content: str, keywords: set[str]) -> tuple[int, int, str]:
        lines = content.splitlines()
        keyword_line_idx = 0

        for idx, line in enumerate(lines):
            low = line.lower()
            if any(keyword in low for keyword in keywords):
                keyword_line_idx = idx
                break

        start = max(0, keyword_line_idx - 4)
        end = min(len(lines), keyword_line_idx + 5)
        excerpt = "\n".join(lines[start:end])
        return start + 1, end, excerpt
