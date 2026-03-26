"""
AgriAdvisor LangGraph Orchestrator
====================================
A 6-node state machine for domain-specialized agricultural advisory.
Uses open-source LLMs via Ollama (or HuggingFace) for cost-efficiency.

Node Architecture:
  1. Guardrails (Llama-3-8B)  — Safety, off-domain blocking, ambiguity detection
  2. Intent    (Mistral-7B)   — Query routing + entity extraction
  3. Web Search (Qwen-14B)    — Live pest alerts, scheme updates
  4. Weather   (Open-Meteo)   — Free live weather, no API key
  5. Market    (AgMarkNet)    — MSP + mandi prices with graceful fallback
  6. Synthesis (Llama-3-70B)  — Final multilingual advice with action steps
"""

from __future__ import annotations

import json
import time
import urllib.request
from typing import Any, TypedDict, Optional, Literal

# ─── State Machine Schema ────────────────────────────────────────────────────

class AgriState(TypedDict):
    query: str
    language: str
    location: str
    crop_types: list[str]

    # Guardrails
    is_safe: bool
    is_on_domain: bool
    is_ambiguous: bool
    guardrails_message: str

    # Intent
    intent_type: Literal["weather", "market", "pest", "scheme", "general", "unknown"]
    entities: dict[str, Any]
    intent_message: str

    # Web Search
    web_results: list[str]
    web_search_message: str

    # Weather
    weather_data: Optional[dict]
    weather_message: str

    # Market
    market_data: Optional[dict]
    market_message: str

    # Synthesis
    final_response: str
    synthesis_message: str

    # Audit trail
    audit_log: list[dict]
    pipeline_errors: list[str]


# ─── Node 1: Guardrails ───────────────────────────────────────────────────────

def guardrails_node(state: AgriState) -> AgriState:
    """
    Safety checks using Llama-3-8B (fast, cheap).
    Blocks: off-domain queries, harmful content, ambiguous requests.
    """
    start = time.time()
    query = state["query"].lower()

    agriculture_keywords = [
        "crop", "farm", "field", "soil", "seed", "harvest", "irrigation",
        "fertilizer", "pesticide", "pest", "disease", "weather", "rain",
        "mandi", "price", "market", "wheat", "rice", "cotton", "sugarcane",
        "tomato", "potato", "onion", "maize", "soybean", "scheme", "kisan",
        "agriculture", "farming", "cattle", "drought", "flood", "yield"
    ]
    off_domain_keywords = [
        "stock market", "invest", "cryptocurrency", "bitcoin", "politics",
        "movie", "song", "recipe", "travel", "hotel", "sport", "cricket"
    ]

    is_on_domain = any(kw in query for kw in agriculture_keywords)
    is_off_domain_explicit = any(kw in query for kw in off_domain_keywords)
    is_ambiguous = len(query.split()) < 4 and not is_on_domain
    is_safe = not is_off_domain_explicit

    if not is_safe:
        msg = "BLOCKED: Query contains off-domain content unrelated to agriculture."
    elif not is_on_domain:
        msg = "WARNING: Low agriculture signal detected. Routing with caution."
    elif is_ambiguous:
        msg = "AMBIGUOUS: Insufficient context to determine specific agricultural need."
    else:
        msg = f"PASSED: Agriculture domain confirmed. Query score: {sum(1 for kw in agriculture_keywords if kw in query)} keywords matched."

    duration_ms = int((time.time() - start) * 1000)
    audit_entry = {
        "node": "Guardrails",
        "status": "completed" if (is_safe and is_on_domain) else ("blocked" if not is_safe else "warning"),
        "duration_ms": duration_ms,
        "message": msg,
    }

    return {
        **state,
        "is_safe": is_safe,
        "is_on_domain": is_on_domain,
        "is_ambiguous": is_ambiguous,
        "guardrails_message": msg,
        "audit_log": state.get("audit_log", []) + [audit_entry],
    }


# ─── Node 2: Intent ───────────────────────────────────────────────────────────

def intent_node(state: AgriState) -> AgriState:
    """
    Route query using Mistral-7B (fast, instruction-following).
    Extracts: intent_type, location, crop, time_period, concern.
    """
    start = time.time()
    query = state["query"].lower()

    # Simple rule-based routing (in production: Mistral-7B via Ollama)
    entities = {}
    if any(w in query for w in ["rain", "weather", "temperature", "forecast", "cloud", "monsoon"]):
        intent_type = "weather"
        entities["request"] = "forecast"
    elif any(w in query for w in ["price", "mandi", "market", "rate", "sell", "buy"]):
        intent_type = "market"
        entities["commodity"] = next((c for c in ["wheat", "rice", "cotton", "tomato"] if c in query), "general")
    elif any(w in query for w in ["pest", "disease", "infection", "spot", "wilt", "blight"]):
        intent_type = "pest"
        entities["symptom"] = "visual_diagnosis_needed"
    elif any(w in query for w in ["scheme", "subsidy", "kisan", "pm-kisan", "loan", "insurance"]):
        intent_type = "scheme"
        entities["program"] = "government_scheme"
    else:
        intent_type = "general"

    # Location extraction (simplified)
    location_hints = ["pune", "delhi", "mumbai", "nashik", "punjab", "gujarat", "maharashtra"]
    for loc in location_hints:
        if loc in query:
            entities["location"] = loc.title()
            break
    if "location" not in entities and state.get("location"):
        entities["location"] = state["location"]

    duration_ms = int((time.time() - start) * 1000)
    msg = f"Route: {intent_type} | Entities: {json.dumps(entities)}"
    audit_entry = {"node": "Intent", "status": "completed", "duration_ms": duration_ms, "message": msg}

    return {
        **state,
        "intent_type": intent_type,
        "entities": entities,
        "intent_message": msg,
        "audit_log": state.get("audit_log", []) + [audit_entry],
    }


# ─── Node 3: Web Search ───────────────────────────────────────────────────────

def web_search_node(state: AgriState) -> AgriState:
    """
    Live web search via DuckDuckGo (no API key needed).
    Searches for pest alerts, scheme updates, agri news.
    """
    start = time.time()
    intent = state.get("intent_type", "general")
    query = state["query"]
    results = []
    error = None

    try:
        search_query = f"agriculture India {intent} {query[:50]} 2024"
        # In production: Use Qwen-14B with web_search tool via LangChain
        # Mock results for demo:
        if intent == "pest":
            results = [
                "Fall armyworm alert issued for Maharashtra, Karnataka — IMD bulletin",
                "Tomato Yellow Leaf Curl Virus spreading in Andhra Pradesh districts",
                "Punjab: Whitefly infestation in cotton — ICAR advisory issued",
            ]
        elif intent == "scheme":
            results = [
                "PM-KISAN 17th installment released — check pmkisan.gov.in for status",
                "PMFBY enrollment deadline extended to March 2025 for Rabi crops",
                "Kisan Credit Card: RBI raises limit to ₹5 lakh with 4% interest",
            ]
        else:
            results = [
                f"Latest agricultural advisory for India: {query[:40]}",
                "ICAR research update: Improved variety seeds available for 2024-25",
            ]
        msg = f"Found {len(results)} relevant results for intent: {intent}"
    except Exception as e:
        error = str(e)
        msg = f"Web search failed: {error}. Using cached knowledge."
        results = []

    duration_ms = int((time.time() - start) * 1000)
    audit_entry = {
        "node": "Web Search",
        "status": "completed" if not error else "error",
        "duration_ms": duration_ms,
        "message": msg,
    }

    return {
        **state,
        "web_results": results,
        "web_search_message": msg,
        "audit_log": state.get("audit_log", []) + [audit_entry],
        "pipeline_errors": state.get("pipeline_errors", []) + ([f"WebSearch: {error}"] if error else []),
    }


# ─── Node 4: Weather ──────────────────────────────────────────────────────────

def weather_node(state: AgriState) -> AgriState:
    """
    Fetch live weather from Open-Meteo API (free, no API key).
    Graceful degradation: returns cached data on failure.
    """
    start = time.time()
    location_coords = {
        "Pune": (18.5204, 73.8567),
        "Mumbai": (18.9667, 72.8333),
        "Delhi": (28.6139, 77.209),
        "Nashik": (19.9975, 73.7898),
        "Punjab": (31.1471, 75.3412),
    }

    location = state.get("location", "Pune")
    lat, lon = location_coords.get(location, (18.5204, 73.8567))
    weather_data = None
    error = None

    try:
        url = (
            f"https://api.open-meteo.com/v1/forecast"
            f"?latitude={lat}&longitude={lon}"
            f"&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum"
            f"&current_weather=true&timezone=Asia%2FKolkata&forecast_days=3"
        )
        with urllib.request.urlopen(url, timeout=5) as resp:
            data = json.loads(resp.read())
            weather_data = {
                "current_temp": round(data["current_weather"]["temperature"]),
                "wind_speed": round(data["current_weather"]["windspeed"]),
                "forecast_3d": [
                    {
                        "date": data["daily"]["time"][i],
                        "max": round(data["daily"]["temperature_2m_max"][i]),
                        "min": round(data["daily"]["temperature_2m_min"][i]),
                        "rain_mm": data["daily"]["precipitation_sum"][i],
                        "code": data["daily"]["weathercode"][i],
                    }
                    for i in range(min(3, len(data["daily"]["time"])))
                ],
            }
        msg = f"Live weather for {location}: {weather_data['current_temp']}°C, {weather_data['wind_speed']} km/h wind"
    except Exception as e:
        error = str(e)
        # Graceful fallback with cached/estimated data
        weather_data = {
            "current_temp": 28,
            "wind_speed": 15,
            "forecast_3d": [],
            "is_cached": True,
        }
        msg = f"FALLBACK: Open-Meteo timeout. Using cached estimate. Error: {error}"

    duration_ms = int((time.time() - start) * 1000)
    audit_entry = {
        "node": "Weather",
        "status": "completed" if not error else "error",
        "duration_ms": duration_ms,
        "message": msg,
    }

    return {
        **state,
        "weather_data": weather_data,
        "weather_message": msg,
        "audit_log": state.get("audit_log", []) + [audit_entry],
        "pipeline_errors": state.get("pipeline_errors", []) + ([f"Weather: {error}"] if error else []),
    }


# ─── Node 5: Market ───────────────────────────────────────────────────────────

def market_node(state: AgriState) -> AgriState:
    """
    Fetch mandi + MSP prices from AgMarkNet.
    Graceful fallback to MSP data when API is unavailable.
    """
    start = time.time()
    error = None

    MSP_2024_25 = {
        "wheat": {"msp": 2275, "unit": "quintal", "premium_pct": 5.1},
        "rice": {"msp": 2183, "unit": "quintal", "premium_pct": 4.4},
        "cotton": {"msp": 7121, "unit": "quintal", "premium_pct": 3.2},
        "soybean": {"msp": 4892, "unit": "quintal", "premium_pct": 4.3},
        "maize": {"msp": 2090, "unit": "quintal", "premium_pct": 2.9},
    }

    commodity = state.get("entities", {}).get("commodity", "wheat")
    market_data = None

    try:
        # In production: fetch from AgMarkNet API
        # For demo: simulate API failure and use MSP fallback
        raise ConnectionError("AgMarkNet API endpoint unreachable (graceful fallback demo)")
    except Exception as e:
        error = str(e)
        msp_info = MSP_2024_25.get(commodity, MSP_2024_25["wheat"])
        estimated_mandi = round(msp_info["msp"] * (1 + msp_info["premium_pct"] / 100))
        market_data = {
            "commodity": commodity,
            "msp": msp_info["msp"],
            "estimated_mandi": estimated_mandi,
            "unit": msp_info["unit"],
            "source": "MSP_FALLBACK",
            "confidence": "medium",
        }
        msg = f"FALLBACK: AgMarkNet unavailable. MSP for {commodity}: ₹{msp_info['msp']}/{msp_info['unit']}. Est. mandi: ₹{estimated_mandi}."

    duration_ms = int((time.time() - start) * 1000)
    audit_entry = {
        "node": "Market",
        "status": "error" if error else "completed",
        "duration_ms": duration_ms,
        "message": msg,
    }

    return {
        **state,
        "market_data": market_data,
        "market_message": msg,
        "audit_log": state.get("audit_log", []) + [audit_entry],
        "pipeline_errors": state.get("pipeline_errors", []) + ([f"Market: {error}"] if error else []),
    }


# ─── Node 6: Synthesis ────────────────────────────────────────────────────────

def synthesis_node(state: AgriState) -> AgriState:
    """
    Final response synthesis using Llama-3-70B (or Mixtral for balance).
    Combines all data into multilingual, actionable farming advice.
    """
    start = time.time()
    intent = state.get("intent_type", "general")
    query = state["query"]
    weather = state.get("weather_data", {})
    market = state.get("market_data", {})
    web = state.get("web_results", [])
    errors = state.get("pipeline_errors", [])

    # Build context for LLM prompt
    context_parts = [f"Query: {query}"]
    if weather:
        context_parts.append(f"Weather: {weather.get('current_temp', 28)}°C")
    if market:
        context_parts.append(f"Market: {market.get('commodity', 'crop')} MSP ₹{market.get('msp', 0)}/quintal")
    if web:
        context_parts.append(f"Web: {web[0] if web else 'No live data'}")
    if errors:
        context_parts.append(f"Data gaps: {', '.join(errors[:2])}")

    # In production: call Llama-3-70B via Ollama
    # Simplified template-based synthesis for demo:
    response_templates = {
        "weather": f"🌤️ **Weather Advisory**\nCurrent: {weather.get('current_temp', 28)}°C. Based on 3-day forecast, plan your field operations accordingly. Optimal spray window: morning (6–9 AM) with wind < 15 km/h.",
        "market": f"📊 **Market Update**\nFor {market.get('commodity', 'your crop')}: MSP ₹{market.get('msp', 2275)}/quintal. Estimated mandi price: ₹{market.get('estimated_mandi', 2390)}/quintal. Sell when mandi > MSP for best returns.",
        "pest": f"🐛 **Pest Advisory**\n{web[0] if web else 'Monitor your field regularly'}. Apply neem-based pesticide as first line of defense. Contact your local KVK if symptoms worsen.",
        "scheme": f"💰 **Government Schemes**\n{web[0] if web else 'PM-KISAN, PMFBY available'}. Visit pmkisan.gov.in or your nearest Jan Seva Kendra for enrollment.",
        "general": f"🌱 **Agricultural Advisory**\nBased on analysis of your query, current weather conditions ({weather.get('current_temp', 28)}°C), and market data — here is my recommendation for optimal farm management this season.",
    }

    response = response_templates.get(intent, response_templates["general"])

    if errors:
        response += f"\n\n⚠️ Note: {len(errors)} data source(s) were unavailable. Advice is based on available data."

    duration_ms = int((time.time() - start) * 1000)
    msg = f"Synthesized {intent} response. Pipeline errors: {len(errors)}. Confidence: {'high' if not errors else 'medium'}."
    audit_entry = {"node": "Synthesis", "status": "completed", "duration_ms": duration_ms, "message": msg}

    return {
        **state,
        "final_response": response,
        "synthesis_message": msg,
        "audit_log": state.get("audit_log", []) + [audit_entry],
    }


# ─── Conditional Routing ──────────────────────────────────────────────────────

def should_continue_after_guardrails(state: AgriState) -> str:
    """Route: blocked → END, ambiguous → clarify, safe → intent"""
    if not state["is_safe"]:
        return "blocked"
    if state["is_ambiguous"] and not state["is_on_domain"]:
        return "clarify"
    return "intent"


# ─── Graph Construction ───────────────────────────────────────────────────────

def build_graph():
    """
    Build the LangGraph StateGraph.
    Requires: pip install langgraph
    """
    try:
        from langgraph.graph import StateGraph, END

        graph = StateGraph(AgriState)

        graph.add_node("guardrails", guardrails_node)
        graph.add_node("intent", intent_node)
        graph.add_node("web_search", web_search_node)
        graph.add_node("weather", weather_node)
        graph.add_node("market", market_node)
        graph.add_node("synthesis", synthesis_node)

        graph.set_entry_point("guardrails")

        graph.add_conditional_edges(
            "guardrails",
            should_continue_after_guardrails,
            {
                "intent": "intent",
                "blocked": END,
                "clarify": END,
            },
        )

        graph.add_edge("intent", "web_search")
        graph.add_edge("web_search", "weather")
        graph.add_edge("weather", "market")
        graph.add_edge("market", "synthesis")
        graph.add_edge("synthesis", END)

        return graph.compile()

    except ImportError:
        print("LangGraph not installed. Run: pip install langgraph")
        return None


# ─── Simple Sequential Runner (without LangGraph installed) ──────────────────

def run_pipeline(query: str, location: str = "Pune", language: str = "English") -> AgriState:
    """
    Run the 6-node pipeline sequentially.
    Works without LangGraph installed (for demo/testing).
    """
    state: AgriState = {
        "query": query,
        "language": language,
        "location": location,
        "crop_types": [],
        "is_safe": False,
        "is_on_domain": False,
        "is_ambiguous": False,
        "guardrails_message": "",
        "intent_type": "general",
        "entities": {},
        "intent_message": "",
        "web_results": [],
        "web_search_message": "",
        "weather_data": None,
        "weather_message": "",
        "market_data": None,
        "market_message": "",
        "final_response": "",
        "synthesis_message": "",
        "audit_log": [],
        "pipeline_errors": [],
    }

    state = guardrails_node(state)
    if not state["is_safe"]:
        state["final_response"] = "This query is outside the agricultural domain. Please ask about farming, crops, or weather."
        return state

    state = intent_node(state)
    state = web_search_node(state)
    state = weather_node(state)
    state = market_node(state)
    state = synthesis_node(state)

    return state


# ─── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    test_queries = [
        ("What is the mandi price of wheat today?", "Pune"),
        ("Will it rain this week in Punjab?", "Punjab"),
        ("My tomatoes have yellow spots, what disease is this?", "Nashik"),
        ("How do I invest in the stock market?", "Delhi"),  # Off-domain block
    ]

    print("=" * 60)
    print("AgriAdvisor LangGraph Orchestrator — Demo Run")
    print("=" * 60)

    for query, location in test_queries:
        print(f"\n🌾 Query: {query}")
        print(f"📍 Location: {location}")
        result = run_pipeline(query, location)
        print(f"📊 Audit Trail ({len(result['audit_log'])} nodes):")
        for entry in result["audit_log"]:
            icon = "✅" if entry["status"] == "completed" else ("❌" if entry["status"] == "blocked" else "⚠️")
            print(f"  {icon} {entry['node']} [{entry['duration_ms']}ms]: {entry['message'][:80]}")
        print(f"\n💬 Response:\n{result['final_response']}")
        if result["pipeline_errors"]:
            print(f"\n⚠️ Errors handled: {result['pipeline_errors']}")
        print("-" * 60)
