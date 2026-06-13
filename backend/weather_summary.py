import json
import os
from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd
import requests
from anthropic import Anthropic
from dotenv import load_dotenv
from pydantic import BaseModel, Field, ValidationError

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


class WeatherSummaryError(RuntimeError):
    """Raised when a validated weather summary cannot be generated."""


class AIWeatherExplanation(BaseModel):
    summary: str = Field(min_length=1, max_length=1200)
    impacts: List[str]

    class Config:
        extra = "forbid"


STAT_COLUMNS = {
    "cape": [
        "convective_available_potential_energy",
        "cape",
        "cape_proxy",
    ],
    "cin": ["convective_inhibition", "cin"],
    "wind_speed": ["wind_speed", "windspeed", "wind_speed_10m"],
    "k_index": ["k_index", "k-index", "kindex"],
    "total_column_water_vapour": [
        "total_column_water_vapour",
        "total_column_water_vapor",
        "tcwv",
    ],
    "total_totals_index": [
        "total_totals_index",
        "total_totals",
        "tt_index",
    ],
    "wind_shear": [
        "wind_shear",
        "bulk_wind_shear_0_6",
        "0-6km_bulk_wind_shear",
        "0_6km_bulk_wind_shear",
        "wind_shear_850_300",
        "850-300hpa_wind_shear",
        "850_300hpa_wind_shear",
    ],
    "dewpoint_depression": [
        "dewpoint_depression",
        "dew_point_depression",
    ],
}

THUNDERSTORM_WEIGHTS = {
    "cape": 0.30,
    "cin": 0.20,
    "k_index": 0.15,
    "total_totals_index": 0.10,
    "total_column_water_vapour": 0.10,
    "dewpoint_depression": 0.05,
    "wind_speed": 0.03,
    "wind_shear": 0.07,
}


def _find_column(df: pd.DataFrame, aliases: List[str]) -> Optional[str]:
    normalized = {
        str(column).strip().lower().replace(" ", "_"): column
        for column in df.columns
    }
    for alias in aliases:
        match = normalized.get(alias.lower().replace(" ", "_"))
        if match is not None:
            return match
    return None


def _rounded_stat(df: pd.DataFrame, column: str, operation: str) -> Optional[float]:
    values = pd.to_numeric(df[column], errors="coerce").dropna()
    if values.empty:
        return None
    value = values.mean() if operation == "mean" else values.max()
    return round(float(value), 2)


def calculate_weather_statistics(df: pd.DataFrame) -> Dict[str, float]:
    stats: Dict[str, float] = {}

    cape_column = _find_column(df, STAT_COLUMNS["cape"])
    if cape_column:
        cape_mean = _rounded_stat(df, cape_column, "mean")
        cape_max = _rounded_stat(df, cape_column, "max")
        if cape_mean is not None:
            stats["cape_mean"] = cape_mean
        if cape_max is not None:
            stats["cape_max"] = cape_max

    for stat_name in (
        "cin",
        "wind_speed",
        "k_index",
        "total_column_water_vapour",
        "total_totals_index",
        "wind_shear",
        "dewpoint_depression",
    ):
        column = _find_column(df, STAT_COLUMNS[stat_name])
        if column:
            value = _rounded_stat(df, column, "mean")
            if value is not None:
                stats[f"{stat_name}_mean"] = value

    return stats


def _piecewise_score(value: float, thresholds: List[float], scores: List[float]) -> float:
    if value <= thresholds[0]:
        return scores[0]
    if value >= thresholds[-1]:
        return scores[-1]

    for index in range(1, len(thresholds)):
        if value <= thresholds[index]:
            lower_value = thresholds[index - 1]
            upper_value = thresholds[index]
            fraction = (value - lower_value) / (upper_value - lower_value)
            return scores[index - 1] + fraction * (scores[index] - scores[index - 1])

    return scores[-1]


def thunderstorm_risk_level(probability: int) -> str:
    if probability <= 20:
        return "Very Low"
    if probability <= 40:
        return "Low"
    if probability <= 60:
        return "Moderate"
    if probability <= 80:
        return "High"
    return "Severe"


def calculate_thunderstorm_probability(stats: Dict[str, float]) -> Dict[str, object]:
    component_scores: Dict[str, float] = {}

    if "cape_mean" in stats:
        cape_value = (
            0.7 * stats["cape_mean"]
            + 0.3 * stats.get("cape_max", stats["cape_mean"])
        )
        component_scores["cape"] = _piecewise_score(
            cape_value,
            [0, 500, 1000, 2000, 3000, 4000],
            [0, 15, 35, 65, 85, 100],
        )
    if "cin_mean" in stats:
        component_scores["cin"] = _piecewise_score(
            abs(stats["cin_mean"]),
            [0, 25, 50, 100, 200, 400],
            [100, 90, 75, 45, 15, 0],
        )
    if "k_index_mean" in stats:
        component_scores["k_index"] = _piecewise_score(
            stats["k_index_mean"],
            [15, 20, 25, 30, 35, 40],
            [0, 10, 30, 55, 80, 100],
        )
    if "total_totals_index_mean" in stats:
        component_scores["total_totals_index"] = _piecewise_score(
            stats["total_totals_index_mean"],
            [35, 40, 45, 50, 55, 60],
            [0, 10, 35, 65, 85, 100],
        )
    if "total_column_water_vapour_mean" in stats:
        component_scores["total_column_water_vapour"] = _piecewise_score(
            stats["total_column_water_vapour_mean"],
            [15, 25, 35, 45, 55, 65],
            [0, 15, 40, 70, 90, 100],
        )
    if "dewpoint_depression_mean" in stats:
        component_scores["dewpoint_depression"] = _piecewise_score(
            stats["dewpoint_depression_mean"],
            [0, 2, 5, 10, 15, 20],
            [100, 90, 70, 35, 10, 0],
        )
    if "wind_speed_mean" in stats:
        component_scores["wind_speed"] = _piecewise_score(
            stats["wind_speed_mean"],
            [0, 3, 7, 12, 20, 30],
            [0, 15, 40, 70, 90, 100],
        )
    if "wind_shear_mean" in stats:
        component_scores["wind_shear"] = _piecewise_score(
            stats["wind_shear_mean"],
            [0, 5, 10, 15, 20, 30],
            [0, 15, 40, 65, 85, 100],
        )

    available_weight = sum(
        THUNDERSTORM_WEIGHTS[name] for name in component_scores
    )
    if available_weight == 0:
        probability = 0
    else:
        probability = round(
            sum(
                component_scores[name] * THUNDERSTORM_WEIGHTS[name]
                for name in component_scores
            )
            / available_weight
        )

    probability = max(0, min(100, probability))
    return {
        "thunderstorm_probability": probability,
        "risk_level": thunderstorm_risk_level(probability),
        "confidence": round(available_weight * 100),
    }


def _validate_summary(raw_text: str, provider: str) -> Dict[str, object]:
    try:
        payload = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise WeatherSummaryError(f"{provider} returned invalid JSON.") from exc

    if not isinstance(payload, dict):
        raise WeatherSummaryError(f"{provider} returned a non-object JSON response.")

    try:
        summary = AIWeatherExplanation.parse_obj(payload)
    except ValidationError as exc:
        raise WeatherSummaryError(
            f"{provider} returned JSON that did not match the weather summary schema."
        ) from exc

    result = summary.dict()
    result["provider"] = provider
    return result


def _anthropic_error_message(exc: Exception) -> str:
    status_code = getattr(exc, "status_code", None)
    body = getattr(exc, "body", None)
    provider_error = body.get("error", {}) if isinstance(body, dict) else {}
    provider_message = str(provider_error.get("message", "")).lower()

    if status_code == 401:
        return "Anthropic rejected the API key. Check or rotate ANTHROPIC_API_KEY."
    if status_code == 403:
        return "The Anthropic account does not have access to the configured model."
    if status_code == 404:
        return "The configured Anthropic model was not found."
    if status_code == 429:
        return "Anthropic rate or usage limits were reached. Try again shortly."
    if status_code == 400 and "credit balance is too low" in provider_message:
        return "Anthropic API credits are exhausted. Add credits in Anthropic Plans & Billing."
    if status_code == 400:
        return "Anthropic rejected the summary request. Check the configured model and account."
    if status_code is not None and status_code >= 500:
        return "Anthropic is temporarily unavailable. Try again shortly."
    if isinstance(exc, (ConnectionError, TimeoutError)):
        return "Could not connect to Anthropic. Check the backend network connection."

    exception_name = type(exc).__name__
    if exception_name in {"APIConnectionError", "APITimeoutError"}:
        return "Could not connect to Anthropic. Check the backend network connection."

    return f"Claude weather summary request failed ({exception_name})."


def _generate_claude_summary(prompt: str) -> Dict[str, object]:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise WeatherSummaryError("ANTHROPIC_API_KEY is not configured.")

    try:
        response = Anthropic(api_key=api_key).messages.create(
            model=os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
            max_tokens=450,
            temperature=0,
            system=(
                    "You are an expert operational meteorologist. Your entire response "
                    "must be strict, valid JSON matching the requested schema. Explain "
                    "the supplied probability and risk; never calculate replacements."
            ),
            messages=[{"role": "user", "content": prompt}],
        )
    except Exception as exc:
        raise WeatherSummaryError(_anthropic_error_message(exc)) from exc

    text_blocks = [
        block.text for block in response.content if getattr(block, "type", None) == "text"
    ]
    if len(text_blocks) != 1:
        raise WeatherSummaryError("Claude returned an unexpected response format.")

    return _validate_summary(text_blocks[0].strip(), "Claude")


def _gemini_error_message(response: requests.Response) -> str:
    if response.status_code in (401, 403):
        return "Gemini rejected the API key. Check or rotate GEMINI_API_KEY."
    if response.status_code == 404:
        return "The configured Gemini model was not found."
    if response.status_code == 429:
        return "Gemini rate or usage limits were reached. Try again shortly."
    if response.status_code >= 500:
        return "Gemini is temporarily unavailable. Try again shortly."
    return "Gemini rejected the summary request. Check the configured model and account."


def _generate_gemini_summary(prompt: str) -> Dict[str, object]:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise WeatherSummaryError("GEMINI_API_KEY is not configured.")

    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    )
    payload = {
        "systemInstruction": {
            "parts": [{
                "text": (
                    "You are an expert operational meteorologist. Your entire "
                    "response must be strict, valid JSON matching the requested schema. "
                    "Explain the supplied probability and risk; never calculate "
                    "replacements."
                )
            }]
        },
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0,
            "maxOutputTokens": 1024,
            "responseMimeType": "application/json",
            "responseJsonSchema": {
                "type": "object",
                "properties": {
                    "summary": {"type": "string"},
                    "impacts": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                },
                "required": ["summary", "impacts"],
                "additionalProperties": False,
            },
            # Gemini 2.5 thinking consumes maxOutputTokens. This task only needs
            # deterministic schema-constrained generation.
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }

    try:
        response = requests.post(
            url,
            params={"key": api_key},
            json=payload,
            timeout=60,
        )
    except requests.RequestException as exc:
        raise WeatherSummaryError(
            "Could not connect to Gemini. Check the backend network connection."
        ) from exc

    if not response.ok:
        raise WeatherSummaryError(_gemini_error_message(response))

    try:
        data = response.json()
        candidate = data["candidates"][0]
        text = "".join(
            part.get("text", "")
            for part in candidate["content"]["parts"]
            if isinstance(part, dict)
        )
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise WeatherSummaryError(
            "Gemini returned an unexpected response format."
        ) from exc

    if candidate.get("finishReason") == "MAX_TOKENS":
        raise WeatherSummaryError(
            "Gemini truncated the weather summary before completing its JSON response."
        )
    if not text.strip():
        raise WeatherSummaryError("Gemini returned an empty weather summary.")

    return _validate_summary(text.strip(), "Gemini")


def generate_weather_summary(df: pd.DataFrame) -> Dict[str, object]:
    stats = calculate_weather_statistics(df)
    probability_result = calculate_thunderstorm_probability(stats)

    prompt = (
        "Explain the supplied scientific thunderstorm probability using the available "
        "aggregate atmospheric statistics. Missing statistics are unavailable and "
        "must not be invented.\n\n"
        f"Thunderstorm Probability: "
        f"{probability_result['thunderstorm_probability']}%\n"
        f"Risk Level: {probability_result['risk_level']}\n"
        f"Evidence Confidence: {probability_result['confidence']}%\n\n"
        f"Statistics: {json.dumps(stats, separators=(',', ':'))}\n\n"
        "Do not generate, change, estimate, or suggest a different probability, risk "
        "level, or confidence. Explain why the supplied result follows from the "
        "available conditions in plain English. If evidence confidence is low, state "
        "that important predictors were unavailable. Return one JSON object only, "
        "with exactly these fields: summary (plain English, at most 120 words) and "
        "impacts (an array of short plain-English strings). Do not use markdown, code "
        "fences, commentary, or text outside the JSON object."
    )

    provider = os.getenv("SUMMARY_PROVIDER", "gemini").strip().lower()
    if provider == "claude":
        explanation = _generate_claude_summary(prompt)
    elif provider == "gemini":
        explanation = _generate_gemini_summary(prompt)
    else:
        raise WeatherSummaryError(
            "SUMMARY_PROVIDER must be either 'gemini' or 'claude'."
        )

    return {**probability_result, **explanation}
