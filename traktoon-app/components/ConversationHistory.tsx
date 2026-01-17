"use client";

import type { ConversationMessage } from "@/types/conversation";

export interface ConversationHistoryProps {
  messages: ConversationMessage[];
}

export const ConversationHistory = ({ messages }: Readonly<ConversationHistoryProps>) => {
  if (messages.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      <h2 className="text-2xl font-bold text-white mb-6">Historique</h2>
      <div className="space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg ${
              message.role === "user"
                ? "bg-zinc-800 text-white"
                : "bg-zinc-900 text-zinc-300 border border-zinc-800"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold uppercase text-zinc-400">
                {message.role === "user" ? "Vous" : "Assistant"}
              </span>
              <span className="text-xs text-zinc-500">
                {message.timestamp.toLocaleTimeString()}
              </span>
            </div>
            <p className="text-lg whitespace-pre-wrap">{message.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
