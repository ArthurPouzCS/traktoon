export type MessageRole = "user" | "assistant" | "system";

export interface ConversationMessage {
  role: MessageRole;
  content: string;
  timestamp: Date;
}

export interface QuestionConfig {
  id: string;
  label: string;
  type: "text" | "textarea";
  required: boolean;
  placeholder?: string;
  propositions?: string[];
}
