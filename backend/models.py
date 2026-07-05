from pydantic import BaseModel
from typing import List

class Post(BaseModel):
    post: str
    hook_type: str
    credibility_moves: List[str]
    word_count: int

class FinalResponse(BaseModel):
    success: bool
    week: int
    focus_topic: str
    posts: List[Post]

class PipelineState(BaseModel):
    week_config: dict
    raw_stories: List[dict] = [] #Added by Agent 1
    scored_stories: List[dict] = [] #Added by Agent 2
    final_posts: List[Post] = [] #Added by Agent 4/5
    unique_stories: List[dict] = [] #Added by Agent 3

    
