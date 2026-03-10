import { clerkClient } from "@clerk/nextjs/server";

interface CaptionItem {
  platform: string;
  caption: string;
  charCount: number;
}

export interface GenerationRecord {
  id: string;
  summary: string;
  captions: CaptionItem[];
  createdAt: string;
}

interface HistoryMetadata {
  generations?: GenerationRecord[];
}

const MAX_HISTORY = 20;

async function getHistory(userId: string): Promise<GenerationRecord[]> {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const meta = user.privateMetadata as HistoryMetadata;
  return meta.generations || [];
}

async function setHistory(
  userId: string,
  generations: GenerationRecord[]
): Promise<void> {
  const client = await clerkClient();
  await client.users.updateUserMetadata(userId, {
    privateMetadata: { generations },
  });
}

export async function saveGeneration(
  userId: string,
  summary: string,
  captions: CaptionItem[]
): Promise<GenerationRecord> {
  const record: GenerationRecord = {
    id: crypto.randomUUID(),
    summary,
    captions,
    createdAt: new Date().toISOString(),
  };

  const history = await getHistory(userId);
  history.unshift(record);

  // Keep only the most recent entries
  await setHistory(userId, history.slice(0, MAX_HISTORY));

  return record;
}

export async function getGenerations(
  userId: string,
  limit = 20,
  offset = 0
): Promise<{ generations: GenerationRecord[]; total: number }> {
  const history = await getHistory(userId);
  return {
    generations: history.slice(offset, offset + limit),
    total: history.length,
  };
}

export async function deleteGeneration(
  id: string,
  userId: string
): Promise<boolean> {
  const history = await getHistory(userId);
  const index = history.findIndex((g) => g.id === id);
  if (index === -1) return false;

  history.splice(index, 1);
  await setHistory(userId, history);
  return true;
}
