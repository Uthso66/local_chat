"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const STORAGE_KEY = "local-chat-history";

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [model, setModel] = useState("qwen2.5:1.5b");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load chat history from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setMessages(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load chat history:", e);
    }
  }, []);

  // Save chat history to localStorage whenever messages change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {
      console.error("Failed to save chat history:", e);
    }
  }, [messages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch available models
  useEffect(() => {
    fetch("http://localhost:8000/models")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.models) && data.models.length > 0) {
          setAvailableModels(data.models);
          setModel(data.models[0]);
        }
      })
      .catch(console.error);
  }, []);

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    const assistantMessage: Message = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMessage]);

    // Create an AbortController for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input, model }),
        signal: controller.signal,
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;

        setMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (updated[lastIdx]?.role === "assistant") {
            updated[lastIdx] = { ...updated[lastIdx], content: fullContent };
          }
          return updated;
        });
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        // User cancelled — update the message to show it was stopped
        setMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (updated[lastIdx]?.role === "assistant") {
            updated[lastIdx] = {
              ...updated[lastIdx],
              content:
                updated[lastIdx].content + "\n\n⏹️ *Generation stopped.*",
            };
          }
          return updated;
        });
      } else {
        console.error("Streaming error:", error);
        setMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (updated[lastIdx]?.role === "assistant") {
            updated[lastIdx] = {
              ...updated[lastIdx],
              content:
                "❌ Error: Failed to get response. Is the backend running?",
            };
          }
          return updated;
        });
      }
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    stopGeneration();
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <main className="p-4 max-w-4xl mx-auto min-h-screen bg-gray-900 text-gray-100">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-white">Local LLM Chat</h1>
        <div className="flex gap-2">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="bg-gray-700 text-gray-100 border border-gray-600 p-1 rounded"
          >
            {availableModels?.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <button
            onClick={clearChat}
            className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="border border-gray-700 rounded p-4 h-[60vh] overflow-y-auto mb-4 bg-gray-800">
        {messages.length === 0 && (
          <p className="text-gray-500 text-center">
            Send a message to start chatting...
          </p>
        )}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`mb-3 p-3 rounded ${
              msg.role === "user"
                ? "bg-blue-700 text-blue-50 ml-auto max-w-[80%]"
                : "bg-gray-700 text-gray-100 border border-gray-600 max-w-[80%]"
            }`}
          >
            <div className="font-bold text-sm mb-1 opacity-75">
              {msg.role === "user" ? "You" : "AI"}
            </div>
            <div className="prose prose-sm prose-invert max-w-none">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="text-gray-400 italic">AI is thinking...</div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <textarea
          className="flex-1 bg-gray-800 text-gray-100 border border-gray-600 p-2 rounded resize-none placeholder-gray-500 focus:outline-none focus:border-blue-500"
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask something... (Shift+Enter for new line)"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        {isLoading ? (
          <button
            type="button"
            onClick={stopGeneration}
            className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!model}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-600 disabled:text-gray-400"
          >
            Send
          </button>
        )}
      </form>
    </main>
  );
}
