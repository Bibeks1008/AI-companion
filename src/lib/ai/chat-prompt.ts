/**
 * Build the system prompt for a chat turn. When the user has past memories,
 * they are appended as a CONTEXT block so the persona can weave them in
 * naturally — never "according to my memory", just the persona's own recall.
 */
export function buildChatSystemPrompt(
  systemPrompt: string,
  memories: string[],
): string {
  if (!memories.length) return systemPrompt;

  const memoryBlock = [
    "",
    "## CONTEXT FROM PAST SESSIONS",
    ...memories.map((m) => `- ${m}`),
  ].join("\n");

  return systemPrompt + memoryBlock;
}
