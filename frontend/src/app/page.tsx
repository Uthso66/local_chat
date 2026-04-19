"use client";

import { useState } from "react";
import { createParser } from "eventsource-parser";

export default function Home() {
  const [input, setInput] = useState("");
  const [response, setResponse] = useState("");

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResponse("");

    const res = await fetch("http://localhost:8000/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: input }),
    });

    if (!res.body) return;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const parser = createParser({
      onEvent: (event) => {
        if (event.data) {
          setResponse((prev) => prev + event.data);
        }
      },
    });

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      parser.feed(chunk);
    }
  };

  return (
    <main className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Local LLM Chat</h1>
      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          className="w-full border p-2"
          rows={3}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask something..."
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Send
        </button>
      </form>
      {response && (
        <div className="mt-4 p-2 border rounded whitespace-pre-wrap">
          {response}
        </div>
      )}
    </main>
  );
}
