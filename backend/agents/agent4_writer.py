from pydantic import BaseModel, Field
from typing import List
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
import json

class DraftPost(BaseModel):
    source_url: str = Field(description="The URL of the story this post is based on")
    post_body: str = Field(description="The LinkedIn post body (150-300 words). DO NOT include a hook/first line.")
    credibility_moves: List[str] = Field(description="Which credibility moves from the style guide were used.")
    word_count: int

class WriterResult(BaseModel):
    drafts: List[DraftPost]

async def run(state: dict) -> dict:
    print("Agent 4: Drafting posts...")
    
    # Safety check: If no stories survived Agent 3, skip writing
    if not state.get("unique_stories"):
        print("No unique stories to write about!")
        return state

    style = state["style_guide"]
    banned_words = ", ".join(style["voice_rules"]["banned_words"])
    credibility_moves = "\n".join(
        [f"- {m['move']}: {m['instruction']}" for m in style["credibility_moves"]["ranked_by_frequency"]]
    )

    topic = state["week_config"]["focus_topic"]

    llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.7) # Temp 0.7 for a little creativity
    structured_llm = llm.with_structured_output(WriterResult)

    system_prompt = f"""
        You are an elite B2B SaaS LinkedIn ghostwriter. 
        Your audience: Founders, sales operators, and RevOps professionals.
        Current Topic: {topic}

        YOUR JOB:
        Write the body of a LinkedIn post for the provided stories. 
        DO NOT write the first line (the hook). Start directly with the context or argument.

        STRICT RULES:
        1. Word count: 150 - 300 words.
        2. NEVER use these banned words: {banned_words}
        3. You MUST include at least one of these 'Credibility Moves':
        {credibility_moves}
        4. Keep paragraphs short (1-2 sentences max).
    """

    stories_text = "\n".join([f"Title: {s['title']}\nURL: {s['url']}\n" for s in state["unique_stories"]])

    result = await structured_llm.ainvoke([
        SystemMessage(content = system_prompt),
        HumanMessage(content=f"Write a draft post body for each of these stories:\n{stories_text}")
    ])

    state["draft_posts"] = [draft.dict() for draft in result.drafts]
    print(f"Agent 4: Successfully drafted {len(state['draft_posts'])} post bodies.")

    return state