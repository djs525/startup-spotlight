from pydantic import BaseModel, Field
from typing import List
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
import json

class FinalPost(BaseModel):
    post: str = Field(description="The complete post: Hook + empty line + Body")
    hook_type: str = Field(description="Must be 'Data' or 'Contrarian'")
    credibility_moves: List[str]
    word_count: int

class HookResults(BaseModel):
    posts: List[FinalPost]

async def run(state: dict) -> dict:
    print("Agent 5: Generating A/B Hooks and assembling final posts...")
    
    if not state.get("draft_posts"):
        state["final_posts"] = []
        return state

    hook_rules = state["style_guide"]["ab_hook_rules"]
    hook_a = hook_rules["hook_a"]
    hook_b = hook_rules["hook_b"]

    llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.8) # Slightly higher temp for punchy hooks
    structured_llm = llm.with_structured_output(HookResults)

    # B. The Assembly Prompt
    system_prompt = f"""
    You are an elite copywriter. You are given draft LinkedIn post bodies.
    For EACH draft, you must create TWO final posts by attaching different hooks to the top.

    HOOK A (Data): {hook_a['instruction']}
    HOOK B (Contrarian): {hook_b['instruction']}

    INSTRUCTIONS:
    1. Read the draft body.
    2. Write Hook A. Combine it with the body (Hook -> blank line -> Body).
    3. Write Hook B. Combine it with the body (Hook -> blank line -> Body).
    4. Pass through the exact credibility_moves from the draft.
    5. Recalculate the final word_count.
    """

    drafts_text = ""
    for idx, draft in enumerate(state["draft_posts"]):
        drafts_text += f"\n--- Draft {idx + 1} ---\nBody: {draft['post_body']}\nCredibility Moves: {draft['credibility_moves']}\n"

    result = await structured_llm.ainvoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=f"Generate the final A/B posts for these drafts:\n{drafts_text}")
    ])

    state["final_posts"] = [p.dict() for p in result.posts]
    print(f"Agent 5: Successfully assembled {len(state['final_posts'])} final posts for A/B testing.")
    
    return state