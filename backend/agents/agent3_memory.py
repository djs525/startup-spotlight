import json
import os

# Always resolve relative to this file's location so CWD doesn't matter
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MEMORY_FILE = os.path.join(BACKEND_DIR, "data", "memory.json")

async def run(state: dict) -> dict:
    print("Agent 3: Checking memory for duplicates...")

    scored_stories = state.get('scored_stories', [])
    unique_stories = []

    past_urls = []
    if os.path.exists(MEMORY_FILE):
        with open(MEMORY_FILE, "r") as f:
            try:
                memory_data = json.load(f)
                # Assuming memory.json looks like: {"posted_urls": ["https://..."]}
                past_urls = memory_data.get("posted_urls", [])
            except json.JSONDecodeError:
                pass

    for story in scored_stories:
        if story['url'] not in past_urls:
            unique_stories.append(story)

    state["unique_stories"] = unique_stories
    print(f"Agent 3: Filtered {len(scored_stories)} down to {len(unique_stories)} unique stories.")
    return state

def save_to_memory(new_urls: list):
    past_urls = []
    if os.path.exists(MEMORY_FILE):
        with open(MEMORY_FILE, "r") as f:
            try:
                memory_data = json.load(f)
                past_urls = memory_data.get("posted_urls", [])
            except json.JSONDecodeError:
                pass
    
    past_urls.extend(new_urls)

    os.makedirs(os.path.dirname(MEMORY_FILE), exist_ok=True)
    with open(MEMORY_FILE, "w") as f:
        json.dump({"posted_urls": past_urls}, f)