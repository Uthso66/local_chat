from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import ollama
from fastapi.middleware.cors import CORSMiddleware
from typing import List

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class MessageItem(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[MessageItem]  # full conversation history
    model: str = "qwen2.5:1.5b"

def generate_stream(model: str, messages: list):
    stream = ollama.chat(
        model=model,
        messages=messages,  # pass entire history
        stream=True,
    )
    for chunk in stream:
        yield chunk["message"]["content"]

@app.get("/models")
async def list_models():
    response = ollama.list()
    models = [model.model for model in response.models]
    return {"models": models}

@app.post("/chat")
async def chat(request: ChatRequest):
    # Convert pydantic models to dicts for ollama
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    return StreamingResponse(
        generate_stream(request.model, messages),
        media_type="text/plain",
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)