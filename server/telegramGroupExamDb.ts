import { and, asc, eq, isNull } from "drizzle-orm";
import {
  telegramGroupExamAnswers,
  telegramGroupExamParticipants,
  telegramGroupExamRounds,
  type TelegramExamQuestion,
} from "../drizzle/schema";
import { getDb } from "./db";
import { listTelegramExamQuestions, type TelegramExamQuestionForSession, type TelegramExamTimeLimit } from "./telegramExamDb";

export type TelegramGroupExamRoundRecord = {
  id: number;
  chatId: string;
  creatorTelegramUserId: string | null;
  subjectKey: string;
  sectionKey: string;
  status: "waiting" | "active" | "completed" | "cancelled";
  questionIndex: number;
  timeLimitSeconds: number;
  activePollId: string | null;
  startedAt: Date | null;
};

export type TelegramGroupExamParticipantRecord = {
  telegramUserId: string;
  displayName: string;
  score: number;
  incorrectCount: number;
  missedCount: number;
};

export type TelegramGroupExamPollResolution = {
  question: TelegramExamQuestionForSession;
  correctCount: number;
  incorrectCount: number;
  missedCount: number;
  participantCount: number;
  nextQuestionIndex: number;
  total: number;
  completed: boolean;
};

function affectedRows(result: unknown): number {
  return Number((result as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0);
}

function asRoundRecord(round: typeof telegramGroupExamRounds.$inferSelect): TelegramGroupExamRoundRecord {
  return {
    id: round.id,
    chatId: round.chatId,
    creatorTelegramUserId: round.creatorTelegramUserId,
    subjectKey: round.subjectKey,
    sectionKey: round.sectionKey,
    status: round.status,
    questionIndex: round.questionIndex,
    timeLimitSeconds: round.timeLimitSeconds,
    activePollId: round.activePollId,
    startedAt: round.startedAt,
  };
}

export async function getTelegramGroupExamRoundByPoll(pollId: string): Promise<TelegramGroupExamRoundRecord | undefined> {
  const db = await getDb();
  if (!db || !pollId) return undefined;
  const rows = await db.select().from(telegramGroupExamRounds)
    .where(and(eq(telegramGroupExamRounds.activePollId, pollId), eq(telegramGroupExamRounds.status, "active")))
    .limit(1);
  return rows[0] ? asRoundRecord(rows[0]) : undefined;
}

export async function getTelegramGroupExamWaitingRound(chatId: string, subjectKey: string, sectionKey: string): Promise<TelegramGroupExamRoundRecord | undefined> {
  const db = await getDb();
  if (!db || !chatId) return undefined;
  const rows = await db.select().from(telegramGroupExamRounds)
    .where(and(
      eq(telegramGroupExamRounds.chatId, chatId),
      eq(telegramGroupExamRounds.subjectKey, subjectKey),
      eq(telegramGroupExamRounds.sectionKey, sectionKey),
      eq(telegramGroupExamRounds.status, "waiting")
    ))
    .orderBy(asc(telegramGroupExamRounds.id))
    .limit(1);
  return rows[0] ? asRoundRecord(rows[0]) : undefined;
}

export async function createTelegramGroupExamRound(input: {
  chatId: string;
  creatorTelegramUserId: string;
  subjectKey: string;
  sectionKey: string;
  timeLimitSeconds: TelegramExamTimeLimit;
}): Promise<{ round: TelegramGroupExamRoundRecord; created: boolean } | undefined> {
  const db = await getDb();
  if (!db || !input.chatId || !input.creatorTelegramUserId || ![15, 30, 60, 300].includes(input.timeLimitSeconds)) return undefined;

  const questions = await listTelegramExamQuestions(input.subjectKey, input.sectionKey);
  if (questions.length === 0) return undefined;

  const activeRows = await db.select().from(telegramGroupExamRounds)
    .where(and(
      eq(telegramGroupExamRounds.chatId, input.chatId),
      eq(telegramGroupExamRounds.subjectKey, input.subjectKey),
      eq(telegramGroupExamRounds.sectionKey, input.sectionKey),
      eq(telegramGroupExamRounds.status, "active")
    ))
    .orderBy(asc(telegramGroupExamRounds.id))
    .limit(1);
  if (activeRows[0]) {
    return { round: asRoundRecord(activeRows[0]), created: false };
  }

  const waitingRound = await getTelegramGroupExamWaitingRound(input.chatId, input.subjectKey, input.sectionKey);
  if (waitingRound) return { round: waitingRound, created: false };

  const created = await db.insert(telegramGroupExamRounds).values({
    chatId: input.chatId,
    creatorTelegramUserId: input.creatorTelegramUserId,
    subjectKey: input.subjectKey,
    sectionKey: input.sectionKey,
    timeLimitSeconds: input.timeLimitSeconds,
  }).$returningId();
  const id = Number(created[0]?.id ?? 0);
  if (id < 1) return undefined;
  const rows = await db.select().from(telegramGroupExamRounds).where(eq(telegramGroupExamRounds.id, id)).limit(1);
  return rows[0] ? { round: asRoundRecord(rows[0]), created: true } : undefined;
}

export async function joinTelegramGroupExamRound(input: {
  roundId: number;
  telegramUserId: string;
  displayName: string;
  username?: string;
}): Promise<{ round: TelegramGroupExamRoundRecord; participantCount: number; joined: boolean } | undefined> {
  const db = await getDb();
  if (!db || !Number.isInteger(input.roundId) || input.roundId < 1 || !input.telegramUserId) return undefined;
  const round = await getTelegramGroupExamRound(input.roundId);
  if (!round || round.status !== "waiting") return undefined;
  const existingParticipant = await db.select({ id: telegramGroupExamParticipants.id })
    .from(telegramGroupExamParticipants)
    .where(and(eq(telegramGroupExamParticipants.roundId, round.id), eq(telegramGroupExamParticipants.telegramUserId, input.telegramUserId)))
    .limit(1);
  let joined = false;
  if (existingParticipant.length === 0) {
    try {
      await db.insert(telegramGroupExamParticipants).values({
        roundId: round.id,
        telegramUserId: input.telegramUserId,
        displayName: input.displayName.slice(0, 255),
        username: input.username?.slice(0, 64) || null,
      });
      joined = true;
    } catch {
      joined = false;
    }
  }
  const participants = await db.select({ id: telegramGroupExamParticipants.id })
    .from(telegramGroupExamParticipants)
    .where(eq(telegramGroupExamParticipants.roundId, round.id));
  return { round, participantCount: participants.length, joined };
}

export async function activateTelegramGroupExamRound(roundId: number): Promise<TelegramGroupExamRoundRecord | undefined> {
  const db = await getDb();
  if (!db || !Number.isInteger(roundId) || roundId < 1) return undefined;
  const participants = await db.select({ id: telegramGroupExamParticipants.id })
    .from(telegramGroupExamParticipants)
    .where(eq(telegramGroupExamParticipants.roundId, roundId));
  if (participants.length < 3) return undefined;
  const updated = await db.update(telegramGroupExamRounds)
    .set({ status: "active", startedAt: new Date() })
    .where(and(eq(telegramGroupExamRounds.id, roundId), eq(telegramGroupExamRounds.status, "waiting")));
  if (affectedRows(updated) < 1) return undefined;
  const rows = await db.select().from(telegramGroupExamRounds).where(eq(telegramGroupExamRounds.id, roundId)).limit(1);
  return rows[0] ? asRoundRecord(rows[0]) : undefined;
}

export async function getTelegramGroupExamRound(roundId: number): Promise<TelegramGroupExamRoundRecord | undefined> {
  const db = await getDb();
  if (!db || !Number.isInteger(roundId) || roundId < 1) return undefined;
  const rows = await db.select().from(telegramGroupExamRounds).where(eq(telegramGroupExamRounds.id, roundId)).limit(1);
  return rows[0] ? asRoundRecord(rows[0]) : undefined;
}

export async function cancelTelegramGroupExamRound(roundId: number): Promise<boolean> {
  const db = await getDb();
  if (!db || !Number.isInteger(roundId) || roundId < 1) return false;
  const result = await db.update(telegramGroupExamRounds)
    .set({ status: "cancelled", activePollId: null, completedAt: new Date() })
    .where(and(
      eq(telegramGroupExamRounds.id, roundId),
      eq(telegramGroupExamRounds.status, "waiting")
    ));
  if (affectedRows(result) > 0) return true;
  const activeResult = await db.update(telegramGroupExamRounds)
    .set({ status: "cancelled", activePollId: null, completedAt: new Date() })
    .where(and(
      eq(telegramGroupExamRounds.id, roundId),
      eq(telegramGroupExamRounds.status, "active")
    ));
  return affectedRows(activeResult) > 0;
}

export async function setTelegramGroupExamActivePoll(input: { roundId: number; questionIndex: number; pollId: string }): Promise<boolean> {
  const db = await getDb();
  if (!db || !input.pollId || input.roundId < 1 || input.questionIndex < 0) return false;
  const result = await db.update(telegramGroupExamRounds)
    .set({ activePollId: input.pollId })
    .where(and(
      eq(telegramGroupExamRounds.id, input.roundId),
      eq(telegramGroupExamRounds.status, "active"),
      eq(telegramGroupExamRounds.questionIndex, input.questionIndex),
      isNull(telegramGroupExamRounds.activePollId)
    ));
  return affectedRows(result) > 0;
}

export async function recordTelegramGroupExamAnswer(input: { pollId: string; telegramUserId: string; answer: "A" | "B" | "C" | "D" }): Promise<boolean> {
  const db = await getDb();
  if (!db || !input.pollId || !input.telegramUserId) return false;
  const round = await getTelegramGroupExamRoundByPoll(input.pollId);
  if (!round) return false;
  const participant = await db.select({ id: telegramGroupExamParticipants.id })
    .from(telegramGroupExamParticipants)
    .where(and(eq(telegramGroupExamParticipants.roundId, round.id), eq(telegramGroupExamParticipants.telegramUserId, input.telegramUserId)))
    .limit(1);
  if (participant.length === 0) return false;
  await db.insert(telegramGroupExamAnswers).values({
    roundId: round.id,
    questionIndex: round.questionIndex,
    telegramUserId: input.telegramUserId,
    answer: input.answer,
  }).onDuplicateKeyUpdate({ set: { answer: input.answer } });
  return true;
}

export async function resolveTelegramGroupExamPoll(pollId: string): Promise<TelegramGroupExamPollResolution | undefined> {
  const db = await getDb();
  if (!db || !pollId) return undefined;
  const round = await getTelegramGroupExamRoundByPoll(pollId);
  if (!round) return undefined;
  const questions = await listTelegramExamQuestions(round.subjectKey, round.sectionKey);
  const question = questions[round.questionIndex];
  if (!question) return undefined;
  const nextQuestionIndex = round.questionIndex + 1;
  const completed = nextQuestionIndex >= questions.length;
  const locked = await db.update(telegramGroupExamRounds)
    .set({
      questionIndex: nextQuestionIndex,
      status: completed ? "completed" : "active",
      activePollId: null,
      completedAt: completed ? new Date() : null,
    })
    .where(and(
      eq(telegramGroupExamRounds.id, round.id),
      eq(telegramGroupExamRounds.status, "active"),
      eq(telegramGroupExamRounds.questionIndex, round.questionIndex),
      eq(telegramGroupExamRounds.activePollId, pollId)
    ));
  if (affectedRows(locked) < 1) return undefined;

  const [participants, answers] = await Promise.all([
    db.select().from(telegramGroupExamParticipants).where(eq(telegramGroupExamParticipants.roundId, round.id)),
    db.select().from(telegramGroupExamAnswers).where(and(
      eq(telegramGroupExamAnswers.roundId, round.id),
      eq(telegramGroupExamAnswers.questionIndex, round.questionIndex)
    )),
  ]);
  const answersByUser = new Map(answers.map(answer => [answer.telegramUserId, answer.answer]));
  let correctCount = 0;
  let incorrectCount = 0;
  let missedCount = 0;
  for (const participant of participants) {
    const answer = answersByUser.get(participant.telegramUserId);
    const correct = answer === question.correctOption;
    if (!answer) missedCount += 1;
    else if (correct) correctCount += 1;
    else incorrectCount += 1;
    await db.update(telegramGroupExamParticipants)
      .set({
        score: participant.score + (correct ? 1 : 0),
        incorrectCount: participant.incorrectCount + (answer && !correct ? 1 : 0),
        missedCount: participant.missedCount + (!answer ? 1 : 0),
      })
      .where(eq(telegramGroupExamParticipants.id, participant.id));
  }
  return {
    question,
    correctCount,
    incorrectCount,
    missedCount,
    participantCount: participants.length,
    nextQuestionIndex,
    total: questions.length,
    completed,
  };
}

export async function getTelegramGroupExamLeaderboard(roundId: number): Promise<TelegramGroupExamParticipantRecord[]> {
  const db = await getDb();
  if (!db || roundId < 1) return [];
  const participants = await db.select({
    telegramUserId: telegramGroupExamParticipants.telegramUserId,
    displayName: telegramGroupExamParticipants.displayName,
    score: telegramGroupExamParticipants.score,
    incorrectCount: telegramGroupExamParticipants.incorrectCount,
    missedCount: telegramGroupExamParticipants.missedCount,
  }).from(telegramGroupExamParticipants).where(eq(telegramGroupExamParticipants.roundId, roundId));
  return participants.sort((a, b) =>
    b.score - a.score || a.incorrectCount - b.incorrectCount || a.missedCount - b.missedCount || a.displayName.localeCompare(b.displayName, "ar")
  );
}
