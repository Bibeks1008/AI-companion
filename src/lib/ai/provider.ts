import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

/**
 * Single provider seam for the app. Business logic never imports a provider SDK
 * directly — it asks for a model here. Switching to Claude later is a one-line
 * change (swap `openai(...)` for `anthropic(...)` and the env var); nothing
 * downstream changes.
 */
const ANALYSIS_MODEL = process.env.AI_ANALYSIS_MODEL ?? "gpt-4o-mini";
const CHAT_MODEL = process.env.AI_CHAT_MODEL ?? "gpt-4o-mini";

export function getAnalysisModel(): LanguageModel {
  return openai(ANALYSIS_MODEL);
}

export function getChatModel(): LanguageModel {
  return openai(CHAT_MODEL);
}
