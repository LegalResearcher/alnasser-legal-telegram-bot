import { and, asc, count, eq, isNull } from "drizzle-orm";
import { telegramExamForms, telegramExamQuestions, telegramExamSessions, type TelegramExamQuestion } from "../drizzle/schema";
import { getDb } from "./db";

export type TelegramExamQuestionForSession = Pick<TelegramExamQuestion, "id" | "questionText" | "optionA" | "optionB" | "optionC" | "optionD" | "correctOption" | "explanation" | "hint" | "sortOrder">;
export type TelegramExamTimeLimit = 15 | 30 | 60 | 300;

export async function listTelegramExamForms(subjectKey: string): Promise<Array<{ formKey: string; formName: string; sortOrder: number; questionCount: number }>> {
  const db = await getDb();
  if (!db || !subjectKey) return [];
  return db.select({
    formKey: telegramExamForms.formKey,
    formName: telegramExamForms.formName,
    sortOrder: telegramExamForms.sortOrder,
    questionCount: count(telegramExamQuestions.id),
  })
    .from(telegramExamForms)
    .leftJoin(telegramExamQuestions, and(
      eq(telegramExamQuestions.subjectKey, telegramExamForms.subjectKey),
      eq(telegramExamQuestions.sectionKey, telegramExamForms.formKey),
      eq(telegramExamQuestions.isActive, true)
    ))
    .where(and(eq(telegramExamForms.subjectKey, subjectKey), eq(telegramExamForms.isActive, true)))
    .groupBy(telegramExamForms.id, telegramExamForms.formKey, telegramExamForms.formName, telegramExamForms.sortOrder)
    .orderBy(asc(telegramExamForms.sortOrder), asc(telegramExamForms.id));
}

export async function listTelegramExamQuestions(subjectKey: string, sectionKey: string): Promise<TelegramExamQuestionForSession[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: telegramExamQuestions.id,
    questionText: telegramExamQuestions.questionText,
    optionA: telegramExamQuestions.optionA,
    optionB: telegramExamQuestions.optionB,
    optionC: telegramExamQuestions.optionC,
    optionD: telegramExamQuestions.optionD,
    correctOption: telegramExamQuestions.correctOption,
    explanation: telegramExamQuestions.explanation,
    hint: telegramExamQuestions.hint,
    sortOrder: telegramExamQuestions.sortOrder,
  })
    .from(telegramExamQuestions)
    .where(and(
      eq(telegramExamQuestions.subjectKey, subjectKey),
      eq(telegramExamQuestions.sectionKey, sectionKey),
      eq(telegramExamQuestions.isActive, true)
    ))
    .orderBy(asc(telegramExamQuestions.sortOrder), asc(telegramExamQuestions.id));
}

export async function startTelegramExamSession(telegramUserId: string, chatId: string, subjectKey: string, sectionKey: string, timeLimitSeconds: TelegramExamTimeLimit): Promise<{ id: number } | undefined> {
  const db = await getDb();
  if (!db || ![15, 30, 60, 300].includes(timeLimitSeconds) || (await listTelegramExamQuestions(subjectKey, sectionKey)).length === 0) return undefined;
  await db.update(telegramExamSessions)
    .set({ status: "cancelled", completedAt: new Date(), activePollId: null })
    .where(and(
      eq(telegramExamSessions.telegramUserId, telegramUserId),
      eq(telegramExamSessions.chatId, chatId),
      eq(telegramExamSessions.status, "active")
    ));
  const result = await db.insert(telegramExamSessions).values({ telegramUserId, chatId, subjectKey, sectionKey, timeLimitSeconds }).$returningId();
  const id = Number(result[0]?.id ?? 0);
  return id > 0 ? { id } : undefined;
}

export async function getTelegramExamSession(sessionId: number, telegramUserId: string) {
  const db = await getDb();
  if (!db || !Number.isInteger(sessionId) || sessionId < 1) return undefined;
  const rows = await db.select()
    .from(telegramExamSessions)
    .where(and(eq(telegramExamSessions.id, sessionId), eq(telegramExamSessions.telegramUserId, telegramUserId)))
    .limit(1);
  return rows[0];
}

export async function setTelegramExamActivePoll(input: { sessionId: number; telegramUserId: string; questionIndex: number; pollId: string }): Promise<boolean> {
  const db = await getDb();
  if (!db || !input.pollId || !Number.isInteger(input.sessionId) || input.sessionId < 1) return false;
  const result = await db.update(telegramExamSessions)
    .set({ activePollId: input.pollId })
    .where(and(
      eq(telegramExamSessions.id, input.sessionId),
      eq(telegramExamSessions.telegramUserId, input.telegramUserId),
      eq(telegramExamSessions.status, "active"),
      eq(telegramExamSessions.questionIndex, input.questionIndex),
      isNull(telegramExamSessions.activePollId)
    ));
  return Number((result as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0) > 0;
}

export async function getTelegramExamSessionByPoll(pollId: string) {
  const db = await getDb();
  if (!db || !pollId) return undefined;
  const rows = await db.select()
    .from(telegramExamSessions)
    .where(and(eq(telegramExamSessions.activePollId, pollId), eq(telegramExamSessions.status, "active")))
    .limit(1);
  return rows[0];
}

export async function cancelTelegramExamSession(telegramUserId: string, chatId: string): Promise<{ subjectKey: string; sectionKey: string } | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const sessions = await db.select({
    id: telegramExamSessions.id,
    subjectKey: telegramExamSessions.subjectKey,
    sectionKey: telegramExamSessions.sectionKey,
  }).from(telegramExamSessions)
    .where(and(
      eq(telegramExamSessions.telegramUserId, telegramUserId),
      eq(telegramExamSessions.chatId, chatId),
      eq(telegramExamSessions.status, "active")
    ))
    .limit(1);
  const session = sessions[0];
  if (!session) return undefined;
  const result = await db.update(telegramExamSessions)
    .set({ status: "cancelled", completedAt: new Date(), activePollId: null })
    .where(and(
      eq(telegramExamSessions.id, session.id),
      eq(telegramExamSessions.telegramUserId, telegramUserId),
      eq(telegramExamSessions.chatId, chatId),
      eq(telegramExamSessions.status, "active")
    ));
  return Number((result as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0) > 0
    ? { subjectKey: session.subjectKey, sectionKey: session.sectionKey }
    : undefined;
}

export async function resolveTelegramExamPoll(input: { sessionId: number; telegramUserId: string; questionIndex: number; pollId: string; answer?: "A" | "B" | "C" | "D" }): Promise<{ question: TelegramExamQuestionForSession; isCorrect: boolean; missed: boolean; score: number; incorrectCount: number; missedCount: number; nextQuestionIndex: number; total: number; completed: boolean; elapsedSeconds: number } | undefined> {
  const db = await getDb();
  if (!db || !Number.isInteger(input.sessionId) || input.sessionId < 1 || input.questionIndex < 0 || !input.pollId) return undefined;
  const session = await getTelegramExamSession(input.sessionId, input.telegramUserId);
  if (!session || session.status !== "active" || session.questionIndex !== input.questionIndex || session.activePollId !== input.pollId) return undefined;
  const questions = await listTelegramExamQuestions(session.subjectKey, session.sectionKey);
  const question = questions[input.questionIndex];
  if (!question) return undefined;
  const missed = !input.answer;
  const isCorrect = !missed && question.correctOption === input.answer;
  const nextQuestionIndex = input.questionIndex + 1;
  const completed = nextQuestionIndex >= questions.length;
  const score = session.score + (isCorrect ? 1 : 0);
  const incorrectCount = session.incorrectCount + (!missed && !isCorrect ? 1 : 0);
  const missedCount = session.missedCount + (missed ? 1 : 0);
  const result = await db.update(telegramExamSessions)
    .set({
      questionIndex: nextQuestionIndex,
      score,
      incorrectCount,
      missedCount,
      status: completed ? "completed" : "active",
      completedAt: completed ? new Date() : null,
      activePollId: null,
    })
    .where(and(
      eq(telegramExamSessions.id, input.sessionId),
      eq(telegramExamSessions.telegramUserId, input.telegramUserId),
      eq(telegramExamSessions.status, "active"),
      eq(telegramExamSessions.questionIndex, input.questionIndex),
      eq(telegramExamSessions.activePollId, input.pollId)
    ));
  if (Number((result as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0) < 1) return undefined;
  return {
    question,
    isCorrect,
    missed,
    score,
    incorrectCount,
    missedCount,
    nextQuestionIndex,
    total: questions.length,
    completed,
    elapsedSeconds: Math.max(0, Math.floor((Date.now() - session.startedAt.getTime()) / 1000)),
  };
}

export async function advanceTelegramExamWrittenQuestion(input: { sessionId: number; telegramUserId: string; questionIndex: number }): Promise<{ score: number; incorrectCount: number; missedCount: number; nextQuestionIndex: number; total: number; completed: boolean; elapsedSeconds: number } | undefined> {
  const db = await getDb();
  if (!db || !Number.isInteger(input.sessionId) || input.sessionId < 1 || input.questionIndex < 0) return undefined;
  const session = await getTelegramExamSession(input.sessionId, input.telegramUserId);
  if (!session || session.status !== "active" || session.questionIndex !== input.questionIndex || session.activePollId) return undefined;
  const questions = await listTelegramExamQuestions(session.subjectKey, session.sectionKey);
  const question = questions[input.questionIndex];
  if (!question || [question.optionA, question.optionB, question.optionC, question.optionD].some(option => option.trim())) return undefined;
  const nextQuestionIndex = input.questionIndex + 1;
  const completed = nextQuestionIndex >= questions.length;
  const result = await db.update(telegramExamSessions)
    .set({
      questionIndex: nextQuestionIndex,
      missedCount: session.missedCount + 1,
      status: completed ? "completed" : "active",
      completedAt: completed ? new Date() : null,
      activePollId: null,
    })
    .where(and(
      eq(telegramExamSessions.id, input.sessionId),
      eq(telegramExamSessions.telegramUserId, input.telegramUserId),
      eq(telegramExamSessions.status, "active"),
      eq(telegramExamSessions.questionIndex, input.questionIndex),
      isNull(telegramExamSessions.activePollId)
    ));
  if (Number((result as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0) < 1) return undefined;
  return {
    score: session.score,
    incorrectCount: session.incorrectCount,
    missedCount: session.missedCount + 1,
    nextQuestionIndex,
    total: questions.length,
    completed,
    elapsedSeconds: Math.max(0, Math.floor((Date.now() - session.startedAt.getTime()) / 1000)),
  };
}
