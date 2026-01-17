"use client";

import { useState } from "react";

export interface PromptFormProps {
  onSubmit: (prompt: string) => void;
}

export const PromptForm = ({ onSubmit }: Readonly<PromptFormProps>) => {
  const [prompt, setPrompt] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (prompt.trim()) {
      onSubmit(prompt.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-4xl mx-auto">
      <div className="flex flex-col gap-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Décrivez votre produit ou service et votre cible client..."
          className="w-full min-h-[200px] px-6 py-4 text-xl bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent resize-none"
          required
        />
        <button
          type="submit"
          className="px-8 py-4 text-xl font-semibold bg-white text-black rounded-lg hover:bg-zinc-200 transition-colors focus:outline-none focus:ring-2 focus:ring-white"
        >
          Générer le plan
        </button>
      </div>
    </form>
  );
};
