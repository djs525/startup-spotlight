import httpx
import re

def _to_keywords(angle: str) -> str:
    """Strip question words and punctuation to get short HN-friendly keywords."""
    # Remove question/filler words
    stopwords = {"how", "are", "what", "which", "why", "the", "is", "in",
                 "of", "a", "an", "and", "or", "for", "to", "on", "at",
                 "with", "do", "does", "we", "vs", "who", "s", "it", "its"}
    words = re.sub(r"[^\w\s]", "", angle.lower()).split()
    keywords = [w for w in words if w not in stopwords]
    return " ".join(keywords[:5])  # max 5 keywords per query

async def run(state: dict) -> dict:
    print("Agent 1 : Researching Topics...")

    week_config = state["week_config"]
    angles = week_config.get("research_angles", [])
    companies = week_config.get("example_companies", [])
    topic = week_config.get("focus_topic", "")

    # Build search queries: short keywords from angles + company names + topic
    queries = [_to_keywords(a) for a in angles]
    queries += companies          # search each example company by name
    queries.append(topic)         # search the topic itself
    queries = list(dict.fromkeys(q for q in queries if q))  # deduplicate

    seen_urls = set()
    all_stories = []

    async with httpx.AsyncClient(timeout=10) as client:
        for query in queries:
            response = await client.get(
                f"https://hn.algolia.com/api/v1/search",
                params={"query": query, "tags": "story", "hitsPerPage": 5}
            )
            if response.status_code != 200:
                continue
            for hit in response.json().get("hits", []):
                url = hit.get("url") or hit.get("objectID")
                if not url or url in seen_urls:
                    continue
                seen_urls.add(url)
                all_stories.append({
                    "title": hit.get("title", ""),
                    "url": url,
                    "source": "Hacker News"
                })

    print(f"Agent 1: Fetched {len(all_stories)} unique stories from {len(queries)} queries.")
    state["raw_stories"] = all_stories
    return state
