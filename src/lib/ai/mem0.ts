const MEM0_BASE = "https://api.mem0.ai/v1";

function headers() {
  return {
    "Content-Type": "application/json",
    Authorization: `Token ${process.env.MEM0_API_KEY}`,
  };
}

type MemorySearchResult = { id: string; memory: string; score: number };

export type ConversationMessage = { role: "user" | "assistant"; content: string };

/**
 * Semantic search over the user's memories. Returns up to 5 relevant strings.
 * Fails silently — memory is best-effort enrichment, not critical path.
 * Hard timeout of 3 s to stay well within the Vercel 10 s function limit.
 */
async function search(userId: string, query: string): Promise<string[]> {
  if (!query.trim() || !process.env.MEM0_API_KEY) return [];
  try {
    const res = await fetch(`${MEM0_BASE}/memories/search/`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ query, user_id: userId, top_k: 5 }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return [];
    const items: MemorySearchResult[] = await res.json();
    return items.map((m) => m.memory);
  } catch {
    return [];
  }
}

/**
 * Extract and store facts from a conversation. Mem0 parses the message array
 * to extract user facts (e.g. "works night duty") that surface in future sessions.
 * Fails silently — memory is best-effort enrichment, not critical path.
 */
async function add(userId: string, messages: ConversationMessage[]): Promise<void> {
  if (!process.env.MEM0_API_KEY || !messages.length) return;
  try {
    await fetch(`${MEM0_BASE}/memories/`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ messages, user_id: userId }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    // best-effort
  }
}

export const mem0 = { search, add };
