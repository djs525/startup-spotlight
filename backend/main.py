import os
import sys
import json
from dotenv import load_dotenv

# Directory containing main.py (i.e. backend/)
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
# Project root (one level up from backend/)
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)

# Load .env.local from the project root so GEMINI_API_KEY is available
# to all agents before any LLM client is initialised.
load_dotenv(os.path.join(PROJECT_ROOT, ".env.local"))

# Ensure the backend package directory is on sys.path so that
# `from agents import ...` works when uvicorn is launched from the project root.
sys.path.insert(0, BACKEND_DIR)

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from agents import agent1_research, agent2_score, agent3_memory, agent4_writer, agent5_hooks

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

@app.get("/generate")
async def generate_posts(
    month: int = Query(default=1, ge=1),
    week: int = Query(default=1, ge=1, le=4),
    topic: str = Query(default=None, description="Override: custom topic (e.g. 'AI in healthcare')"),
    industry: str = Query(default=None, description="Override: custom industry (e.g. 'HealthTech')")
):
    print(f"--- STARTING PIPELINE FOR MONTH {month}, WEEK {week} ---")

    # 1. Dynamically construct the file path (relative to backend/ dir)
    config_file = os.path.join(BACKEND_DIR, "config", f"month{month}.json")

    if not os.path.exists(config_file):
        raise HTTPException(status_code=404, detail=f"Config file config/month{month}.json not found.")

    with open(config_file, "r") as f:
        month_config = json.load(f)

    week_config = month_config["weeks"][week-1]
    with open(os.path.join(BACKEND_DIR, "data", "style_guide.json"), "r") as f:
        style_guide = json.load(f)

    # 2. Allow user to override topic/industry on the fly
    if topic:
        print(f"--- CUSTOM TOPIC OVERRIDE: {topic} ---")
        week_config = {
            **week_config,               # keep post_themes etc. as fallback
            "focus_topic": topic,
            "description": f"User-defined topic: {topic}",
            "example_companies": [],     # no pre-set companies for custom topics
            "research_angles": [
                f"{topic} startups",
                f"{topic} funding",
                f"{topic} tools",
                f"{topic} trends {industry or ''}".strip(),
                f"best {topic} software",
            ]
        }
    if industry:
        week_config["industry"] = industry

    state = {
        "week_config": week_config,
        "style_guide": style_guide,
        "raw_stories": [],
        "scored_stories": [],
        "unique_stories": [],
        "draft_posts": [],
        "final_posts": []
    }

    print("Handing off to Agent 1: Research")
    state = await agent1_research.run(state)

    print("Handing off to Agent 2: Scoring")
    state = await agent2_score.run(state)

    print("Handing off to Agent 3: Memory")
    state = await agent3_memory.run(state)

    print("Handing off to Agent 4...")
    state = await agent4_writer.run(state)
    
    print("Handing off to Agent 5...")
    state = await agent5_hooks.run(state)

    # Save to memory once pipeline succeeds
    if state["unique_stories"]:
        urls_to_save = [s['url'] for s in state["unique_stories"]]
        agent3_memory.save_to_memory(urls_to_save)

    print(f"--- PIPELINE COMPLETE! Generated {len(state['final_posts'])} posts. ---")

    return {
        "success": True,
        "week": week,
        "focus_topic": week_config["focus_topic"],
        "posts": state["final_posts"]
    }