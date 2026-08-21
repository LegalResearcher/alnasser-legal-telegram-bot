import { and, eq } from "drizzle-orm";
import { telegramExamSessions } from "../drizzle/schema";
import { getDb } from "./db";
import type { TelegramExamResultSummary } from "./telegram";

type ResultSnapshot = { score: number; incorrectCount: number; missedCount: number; elapsedSeconds: number };

function toSnapshot(row: { score: number; incorrectCount: number; missedCount: number; startedAt: Date; completedAt: Date | null }): ResultSnapshot {
  return {
    score: row.score,
    incorrectCount: row.incorrectCount,
    missedCount: row.missedCount,
    elapsedSeconds: Math.max(0, Math.floor(((row.completedAt ?? new Date()).getTime() - row.startedAt.getTime()) / 1000)),
  };
}

function compareResults(left: ResultSnapshot, right: ResultSnapshot): number {
  return right.score - left.score
    || left.incorrectCount - right.incorrectCount
    || left.missedCount - right.missedCount
    || left.elapsedSeconds - right.elapsedSeconds;
}

export async function getTelegramExamResultSummary(sessionId: number, telegramUserId: string): Promise<TelegramExamResultSummary | undefined> {
  const db = await getDb();
  if (!db || !Number.isInteger(sessionId) || sessionId < 1) return undefined;
  const currentRows = await db.select()
    .from(telegramExamSessions)
    .where(and(eq(telegramExamSessions.id, sessionId), eq(telegramExamSessions.telegramUserId, telegramUserId), eq(telegramExamSessions.status, "completed")))
    .limit(1);
  const current = currentRows[0];
  if (!current) return undefined;
  const completed = await db.select()
    .from(telegramExamSessions)
    .where(and(
      eq(telegramExamSessions.subjectKey, current.subjectKey),
      eq(telegramExamSessions.sectionKey, current.sectionKey),
      eq(telegramExamSessions.status, "completed")
    ));
  const previousBest = completed
    .filter(row => row.telegramUserId === telegramUserId && row.id !== sessionId)
    .map(toSnapshot)
    .sort(compareResults)[0];
  const bestByUser = new Map<string, ResultSnapshot>();
  for (const row of completed) {
    const candidate = toSnapshot(row);
    const known = bestByUser.get(row.telegramUserId);
    if (!known || compareResults(candidate, known) < 0) bestByUser.set(row.telegramUserId, candidate);
  }
  const leaderboard = Array.from(bestByUser.entries()).sort(([, left], [, right]) => compareResults(left, right));
  const leaderboardResult = bestByUser.get(telegramUserId) ?? toSnapshot(current);
  const rank = Math.max(1, leaderboard.findIndex(([userId]) => userId === telegramUserId) + 1);
  const totalParticipants = Math.max(1, leaderboard.length);
  return {
    previousBest,
    leaderboardResult,
    rank,
    totalParticipants,
    percentile: Math.floor(((totalParticipants - rank + 1) / totalParticipants) * 100),
  };
}
