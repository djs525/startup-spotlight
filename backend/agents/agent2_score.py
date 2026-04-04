from pydantic import BaseModel, Field
from typing import List
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage

class StoryScore(BaseModel):
    title: str
    url: str
    score: int = Field(description="Score from 1-10")
    reason: str = Field(description="Briefly why it got this score")

class ScoringResult(BaseModel):
    scores: List[StoryScore]

async def run(state: dict):
    llm = ChatGoogleGenerativeAI(
        model = "gemini-2.5-flash"
    )
    structured_llm = llm.with_structured_output(ScoringResult)
    topic = state['week_config']['focus_topic']
    description = state['week_config']['description']
    examples = ", ".join(state['week_config'].get('example_companies', []))

    system_prompt = f"""
    You are the 'Gatekeeper' for a B2B LinkedIn newsletter. 
    Your current focus is: {topic} ({description}).

    SCORING RUBRIC:
    - 10/10: Specifically mentions one of these companies ({examples}) or a direct competitor.
    - 7-9/10: Discusses a tactical 'how-to' or news story strictly about {topic}.
    - 4-6/10: General AI/Tech news that is only tangentially related.
    - 1-3/10: Vague fluff, philosophical essays, or completely irrelevant topics.

    Only return the scores. Be extremely strict.
    """

    stories_text = "\n".join([f"- {s['title']} ({s['url']})" for s in state['raw_stories']])
    result = await structured_llm.ainvoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=f"Score these stories based on our rubric:\n{stories_text}")
    ])

    state["scored_stories"] = [s.model_dump() for s in result.scores if s.score >= 7]

    print(f"Agent 2: Filtered {len(state['raw_stories'])} down to {len(state['scored_stories'])} quality stories.")
    return state