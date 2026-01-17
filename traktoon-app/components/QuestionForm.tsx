"use client";

import { useState } from "react";
import type { QuestionConfig } from "@/types/conversation";

export interface QuestionFormProps {
  questions: QuestionConfig[];
  onSubmit: (answers: Record<string, string>) => void;
}

export const QuestionForm = ({ questions, onSubmit }: Readonly<QuestionFormProps>) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    if (errors[id]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[id];
        return newErrors;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    questions.forEach((question) => {
      if (question.required && !answers[question.id]?.trim()) {
        newErrors[question.id] = "Ce champ est requis";
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(answers);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-6">
      {questions.map((question) => {
        const isTextarea = question.type === "textarea";
        const InputComponent = isTextarea ? "textarea" : "input";
        const hasError = !!errors[question.id];

        return (
          <div key={question.id} className="flex flex-col gap-2">
            <label htmlFor={question.id} className="text-base text-zinc-400">
              {question.label}
              {question.required && <span className="text-red-400 ml-1">*</span>}
            </label>
            <InputComponent
              id={question.id}
              value={answers[question.id] || ""}
              onChange={(e) => handleChange(question.id, e.target.value)}
              placeholder={question.placeholder}
              required={question.required}
              className={`w-full h-14 px-4 bg-zinc-900 border ${
                hasError ? "border-red-500" : "border-zinc-800"
              } rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent text-base ${
                isTextarea ? "min-h-[120px] py-4 resize-none" : ""
              }`}
            />
            {hasError && (
              <span className="text-red-400 text-sm">{errors[question.id]}</span>
            )}
          </div>
        );
      })}
      <button
        type="submit"
        className="mt-2 w-full flex items-center justify-center gap-2 px-2 py-1 bg-zinc-900 rounded-lg text-white font-medium hover:bg-zinc-800 transition-colors"
      >
        Générer le plan go-to-market
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>
    </form>
  );
};
