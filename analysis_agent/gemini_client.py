from __future__ import annotations

import json
import re
import time
from typing import Any

import httpx

from analysis_agent.config import get_settings


class GeminiClientError(Exception):
    pass


class GeminiClient:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def generate_report(self, prompt: str) -> tuple[dict[str, Any], dict[str, Any]]:
        if not self.settings.gemini_api_key:
            raise GeminiClientError("GEMINI_API_KEY is not configured")

        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.settings.gemini_model}:generateContent?key={self.settings.gemini_api_key}"
        )
        body = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"},
        }

        last_error: Exception | None = None
        started = time.perf_counter()

        for attempt in range(self.settings.gemini_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=self.settings.gemini_timeout_sec) as client:
                    response = await client.post(url, json=body)
                response.raise_for_status()
                payload = response.json()
                text = self._extract_text(payload)
                parsed = self._extract_json(text)
                elapsed_ms = int((time.perf_counter() - started) * 1000)
                usage = payload.get("usageMetadata", {})
                token_usage = {
                    "input": int(usage.get("promptTokenCount", 0)),
                    "output": int(usage.get("candidatesTokenCount", 0)),
                    "total": int(usage.get("totalTokenCount", 0)),
                }
                return parsed, {"latency_ms": elapsed_ms, "token_usage": token_usage}
            except Exception as exc:  # noqa: BLE001
                last_error = exc
                if attempt >= self.settings.gemini_retries:
                    break

        raise GeminiClientError(f"Gemini request failed: {last_error}") from last_error

    def _extract_text(self, payload: dict[str, Any]) -> str:
        candidates = payload.get("candidates", [])
        if not candidates:
            raise GeminiClientError("No candidates in Gemini response")

        parts = candidates[0].get("content", {}).get("parts", [])
        text_parts = [part.get("text", "") for part in parts if isinstance(part, dict)]
        output = "\n".join(text_parts).strip()
        if not output:
            raise GeminiClientError("Gemini output was empty")
        return output

    def _extract_json(self, text: str) -> dict[str, Any]:
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
            cleaned = re.sub(r"```$", "", cleaned).strip()

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", cleaned, re.DOTALL)
            if not match:
                raise GeminiClientError("Gemini output did not contain JSON")
            return json.loads(match.group(0))
