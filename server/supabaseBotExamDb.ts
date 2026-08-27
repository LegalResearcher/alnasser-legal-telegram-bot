import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { TelegramExamPollResolution, TelegramExamResultSummary, TelegramExamSessionRecord, TelegramWrittenExamResolution } from "./telegram";
import type { TelegramExamQuestionForSession } from "./telegramExamDb";

const DEFAULT_SUPABASE_URL = "https://nhrlwemvkvgmtzoiwcym.supabase.co";

type BotExamFormRow = {
  form_key: string;
  form_name: string;
  sort_order: number;
};

type BotExamQuestionRow = {
  id: number;
  source_question_id: string;
  subject_key: string;
  section_key: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: "A" | "B" | "C" | "D";
  explanation: string;
  hint: string | null;
  sort_order: number;
};

type BotExamSessionRow = {
  id: number;
  telegram_user_id: string;
  chat_id: string;
  subject_key: string;
  section_key: string;
  status: "active" | "completed" | "cancelled";
  question_index: number;
  score: number;
  incorrect_count: number;
  missed_count: number;
  time_limit_seconds: number;
  active_poll_id: string | null;
  started_at: string;
};

type BotExamResultRow = {
  score: number;
  incorrect_count: number;
  missed_count: number;
  elapsed_seconds: number;
  created_at: string;
};

function getSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "x-client-info": "alnasser-telegram-bot" } },
  });
}

function assertNoSupabaseError(error: { message?: string } | null, operation: string): void {
  if (error) throw new Error(`Supabase ${operation} failed: ${error.message ?? "unknown error"}`);
}

function mapQuestion(row: BotExamQuestionRow): TelegramExamQuestionForSession {
  return {
    id: Number(row.id),
    questionText: row.question_text,
    optionA: row.option_a,
    optionB: row.option_b,
    optionC: row.option_c,
    optionD: row.option_d,
    correctOption: row.correct_option,
    explanation: row.explanation ?? "",
    hint: row.hint,
    sortOrder: Number(row.sort_order),
  };
}

function mapSession(row: BotExamSessionRow): TelegramExamSessionRecord {
  return {
    id: Number(row.id),
    telegramUserId: row.telegram_user_id,
    chatId: row.chat_id,
    subjectKey: row.subject_key,
    sectionKey: row.section_key,
    status: row.status,
    questionIndex: Number(row.question_index),
    score: Number(row.score),
    incorrectCount: Number(row.incorrect_count),
    missedCount: Number(row.missed_count),
    timeLimitSeconds: Number(row.time_limit_seconds),
    activePollId: row.active_poll_id,
    startedAt: new Date(row.started_at),
  };
}

async function listSupabaseExamQuestions(client: SupabaseClient, subjectKey: string, sectionKey: string): Promise<TelegramExamQuestionForSession[]> {
  const { data, error } = await client
    .from("bot_exam_questions")
    .select("id,source_question_id,subject_key,section_key,question_text,option_a,option_b,option_c,option_d,correct_option,explanation,hint,sort_order")
    .eq("subject_key", subjectKey)
    .eq("section_key", sectionKey)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true })
    .limit(1000);
  assertNoSupabaseError(error, "list questions");
  return ((data ?? []) as BotExamQuestionRow[]).map(mapQuestion);
}

async function insertResultIfCompleted(client: SupabaseClient, session: TelegramExamSessionRecord, result: { score: number; incorrectCount: number; missedCount: number; elapsedSeconds: number }): Promise<void> {
  const { error } = await client.from("bot_exam_results").insert({
    session_id: session.id,
    telegram_user_id: session.telegramUserId,
    subject_key: session.subjectKey,
    section_key: session.sectionKey,
    score: result.score,
    incorrect_count: result.incorrectCount,
    missed_count: result.missedCount,
    elapsed_seconds: result.elapsedSeconds,
  });
  assertNoSupabaseError(error, "save result");
}

export type SupabaseBotExamStatistics = {
  formCount: number;
  questionCount: number;
  subjectKeys: string[];
  totalExams: number;
};

export async function getSupabaseBotExamStatistics(): Promise<SupabaseBotExamStatistics> {
  const client = getSupabase();
  const [formsResult, questionsResult, subjectsResult, platformStatsResult, examSummaryResult] = await Promise.all([
    client.from("bot_exam_forms").select("id", { count: "exact", head: true }).eq("is_active", true),
    client.from("bot_exam_questions").select("id", { count: "exact", head: true }).eq("is_active", true),
    client.from("bot_exam_forms").select("subject_key").eq("is_active", true).limit(1000),
    client.from("platform_stats").select("total_exams").eq("id", 1).limit(1).maybeSingle(),
    client.rpc("get_exam_results_summary"),
  ]);
  assertNoSupabaseError(formsResult.error, "count forms");
  assertNoSupabaseError(questionsResult.error, "count questions");
  assertNoSupabaseError(subjectsResult.error, "list exam subjects");
  assertNoSupabaseError(platformStatsResult.error, "read platform exam stats");
  assertNoSupabaseError(examSummaryResult.error, "read exam results summary");
  const subjectKeys = Array.from(new Set(((subjectsResult.data ?? []) as Array<{ subject_key?: string }>).map(row => row.subject_key).filter((key): key is string => Boolean(key))));
  const archivedExams = Number((platformStatsResult.data as { total_exams?: number } | null)?.total_exams ?? 0);
  const currentExams = Number((examSummaryResult.data as { total?: number } | null)?.total ?? 0);
  return { formCount: Number(formsResult.count ?? 0), questionCount: Number(questionsResult.count ?? 0), subjectKeys, totalExams: archivedExams + currentExams };
}

export async function listSupabaseBotExamForms(subjectKey: string): Promise<Array<{ formKey: string; formName: string; sortOrder: number; questionCount: number }>> {
  const client = getSupabase();
  const { data, error } = await client
    .from("bot_exam_forms")
    .select("form_key,form_name,sort_order")
    .eq("subject_key", subjectKey)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true })
    .limit(100);
  assertNoSupabaseError(error, "list forms");
  const forms = (data ?? []) as BotExamFormRow[];
  return Promise.all(forms.map(async form => {
    const { count, error: countError } = await client
      .from("bot_exam_questions")
      .select("id", { count: "exact", head: true })
      .eq("subject_key", subjectKey)
      .eq("section_key", form.form_key)
      .eq("is_active", true);
    assertNoSupabaseError(countError, "count form questions");
    return { formKey: form.form_key, formName: form.form_name, sortOrder: Number(form.sort_order), questionCount: count ?? 0 };
  }));
}

export async function listSupabaseBotExamQuestions(subjectKey: string, sectionKey: string): Promise<Array<{ id: number; questionText: string; optionA: string; optionB: string; optionC: string; optionD: string; correctOption: "A" | "B" | "C" | "D"; explanation: string; hint: string | null; sortOrder: number }>> {
  return listSupabaseExamQuestions(getSupabase(), subjectKey, sectionKey);
}

export async function startSupabaseBotExamSession(telegramUserId: string, chatId: string, subjectKey: string, sectionKey: string, timeLimitSeconds: 15 | 30 | 60 | 300): Promise<{ id: number } | undefined> {
  const client = getSupabase();
  const now = new Date().toISOString();
  const { error: cancelError } = await client.from("bot_exam_sessions")
    .update({ status: "cancelled", completed_at: now, active_poll_id: null, updated_at: now })
    .eq("telegram_user_id", telegramUserId)
    .eq("chat_id", chatId)
    .eq("status", "active");
  assertNoSupabaseError(cancelError, "cancel previous sessions");
  const { data, error } = await client.from("bot_exam_sessions").insert({
    telegram_user_id: telegramUserId,
    chat_id: chatId,
    subject_key: subjectKey,
    section_key: sectionKey,
    time_limit_seconds: timeLimitSeconds,
  }).select("id").limit(1).maybeSingle();
  assertNoSupabaseError(error, "start session");
  return data ? { id: Number((data as { id: number }).id) } : undefined;
}

export async function getSupabaseBotExamSession(sessionId: number, telegramUserId: string): Promise<TelegramExamSessionRecord | undefined> {
  const { data, error } = await getSupabase().from("bot_exam_sessions")
    .select("id,telegram_user_id,chat_id,subject_key,section_key,status,question_index,score,incorrect_count,missed_count,time_limit_seconds,active_poll_id,started_at")
    .eq("id", sessionId)
    .eq("telegram_user_id", telegramUserId)
    .limit(1)
    .maybeSingle();
  assertNoSupabaseError(error, "get session");
  return data ? mapSession(data as BotExamSessionRow) : undefined;
}

export async function setSupabaseBotExamActivePoll(input: { sessionId: number; telegramUserId: string; questionIndex: number; pollId: string }): Promise<boolean> {
  const { data, error } = await getSupabase().from("bot_exam_sessions")
    .update({ active_poll_id: input.pollId, updated_at: new Date().toISOString() })
    .eq("id", input.sessionId)
    .eq("telegram_user_id", input.telegramUserId)
    .eq("status", "active")
    .eq("question_index", input.questionIndex)
    .is("active_poll_id", null)
    .select("id");
  assertNoSupabaseError(error, "set active poll");
  return Array.isArray(data) && data.length > 0;
}

export async function getSupabaseBotExamSessionByPoll(pollId: string): Promise<TelegramExamSessionRecord | undefined> {
  const { data, error } = await getSupabase().from("bot_exam_sessions")
    .select("id,telegram_user_id,chat_id,subject_key,section_key,status,question_index,score,incorrect_count,missed_count,time_limit_seconds,active_poll_id,started_at")
    .eq("active_poll_id", pollId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  assertNoSupabaseError(error, "get session by poll");
  return data ? mapSession(data as BotExamSessionRow) : undefined;
}

export async function cancelSupabaseBotExamSession(telegramUserId: string, chatId: string): Promise<{ subjectKey: string; sectionKey: string } | undefined> {
  const client = getSupabase();
  const { data, error } = await client.from("bot_exam_sessions")
    .select("id,subject_key,section_key")
    .eq("telegram_user_id", telegramUserId)
    .eq("chat_id", chatId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  assertNoSupabaseError(error, "find active session");
  if (!data) return undefined;
  const session = data as { id: number; subject_key: string; section_key: string };
  const { data: updated, error: updateError } = await client.from("bot_exam_sessions")
    .update({ status: "cancelled", completed_at: new Date().toISOString(), active_poll_id: null, updated_at: new Date().toISOString() })
    .eq("id", session.id)
    .eq("telegram_user_id", telegramUserId)
    .eq("chat_id", chatId)
    .eq("status", "active")
    .select("id");
  assertNoSupabaseError(updateError, "cancel session");
  return Array.isArray(updated) && updated.length > 0 ? { subjectKey: session.subject_key, sectionKey: session.section_key } : undefined;
}

export async function resolveSupabaseBotExamPoll(input: { sessionId: number; telegramUserId: string; questionIndex: number; pollId: string; answer?: "A" | "B" | "C" | "D" }): Promise<TelegramExamPollResolution | undefined> {
  const client = getSupabase();
  const session = await getSupabaseBotExamSession(input.sessionId, input.telegramUserId);
  if (!session || session.status !== "active" || session.questionIndex !== input.questionIndex || session.activePollId !== input.pollId) return undefined;
  const questions = await listSupabaseExamQuestions(client, session.subjectKey, session.sectionKey);
  const question = questions[input.questionIndex];
  if (!question) return undefined;
  const missed = !input.answer;
  const isCorrect = !missed && question.correctOption === input.answer;
  const nextQuestionIndex = input.questionIndex + 1;
  const completed = nextQuestionIndex >= questions.length;
  const result = {
    score: session.score + (isCorrect ? 1 : 0),
    incorrectCount: session.incorrectCount + (!missed && !isCorrect ? 1 : 0),
    missedCount: session.missedCount + (missed ? 1 : 0),
    nextQuestionIndex,
    total: questions.length,
    completed,
    elapsedSeconds: Math.max(0, Math.floor((Date.now() - session.startedAt.getTime()) / 1000)),
  };
  const { data, error } = await client.from("bot_exam_sessions")
    .update({
      question_index: result.nextQuestionIndex,
      score: result.score,
      incorrect_count: result.incorrectCount,
      missed_count: result.missedCount,
      status: result.completed ? "completed" : "active",
      completed_at: result.completed ? new Date().toISOString() : null,
      active_poll_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.sessionId)
    .eq("telegram_user_id", input.telegramUserId)
    .eq("status", "active")
    .eq("question_index", input.questionIndex)
    .eq("active_poll_id", input.pollId)
    .select("id");
  assertNoSupabaseError(error, "resolve poll");
  if (!Array.isArray(data) || data.length === 0) return undefined;
  if (result.completed) await insertResultIfCompleted(client, session, result);
  return { question: { ...question }, isCorrect, missed, ...result };
}

export async function advanceSupabaseBotExamWrittenQuestion(input: { sessionId: number; telegramUserId: string; questionIndex: number }): Promise<TelegramWrittenExamResolution | undefined> {
  const client = getSupabase();
  const session = await getSupabaseBotExamSession(input.sessionId, input.telegramUserId);
  if (!session || session.status !== "active" || session.questionIndex !== input.questionIndex || session.activePollId) return undefined;
  const questions = await listSupabaseExamQuestions(client, session.subjectKey, session.sectionKey);
  const question = questions[input.questionIndex];
  if (!question || [question.optionA, question.optionB, question.optionC, question.optionD].some(option => option.trim())) return undefined;
  const nextQuestionIndex = input.questionIndex + 1;
  const completed = nextQuestionIndex >= questions.length;
  const result = {
    score: session.score,
    incorrectCount: session.incorrectCount,
    missedCount: session.missedCount + 1,
    nextQuestionIndex,
    total: questions.length,
    completed,
    elapsedSeconds: Math.max(0, Math.floor((Date.now() - session.startedAt.getTime()) / 1000)),
  };
  const { data, error } = await client.from("bot_exam_sessions")
    .update({ question_index: result.nextQuestionIndex, missed_count: result.missedCount, status: result.completed ? "completed" : "active", completed_at: result.completed ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq("id", input.sessionId)
    .eq("telegram_user_id", input.telegramUserId)
    .eq("status", "active")
    .eq("question_index", input.questionIndex)
    .is("active_poll_id", null)
    .select("id");
  assertNoSupabaseError(error, "advance written question");
  if (!Array.isArray(data) || data.length === 0) return undefined;
  if (result.completed) await insertResultIfCompleted(client, session, result);
  return result;
}

export async function getSupabaseBotExamResultSummary(sessionId: number, telegramUserId: string): Promise<TelegramExamResultSummary | undefined> {
  const client = getSupabase();
  const session = await getSupabaseBotExamSession(sessionId, telegramUserId);
  if (!session || session.status !== "completed") return undefined;
  const { data, error } = await client.from("bot_exam_results")
    .select("score,incorrect_count,missed_count,elapsed_seconds,created_at")
    .eq("subject_key", session.subjectKey)
    .eq("section_key", session.sectionKey)
    .order("score", { ascending: false })
    .order("elapsed_seconds", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1000);
  assertNoSupabaseError(error, "list results");
  const results = (data ?? []) as BotExamResultRow[];
  const current = results.find(result => result.created_at >= session.startedAt.toISOString());
  const toSummary = (result: BotExamResultRow | undefined) => result ? { score: Number(result.score), incorrectCount: Number(result.incorrect_count), missedCount: Number(result.missed_count), elapsedSeconds: Number(result.elapsed_seconds) } : undefined;
  const currentSummary = toSummary(current) ?? { score: session.score, incorrectCount: session.incorrectCount, missedCount: session.missedCount, elapsedSeconds: Math.max(0, Math.floor((Date.now() - session.startedAt.getTime()) / 1000)) };
  const rank = current ? results.findIndex(result => result === current) + 1 : results.length + 1;
  const previousBest = results.filter(result => result !== current).sort((a, b) => Number(b.score) - Number(a.score) || Number(a.elapsed_seconds) - Number(b.elapsed_seconds))[0];
  const leaderboardResult = results[0] ?? current;
  return {
    previousBest: toSummary(previousBest),
    leaderboardResult: toSummary(leaderboardResult) ?? currentSummary,
    rank,
    totalParticipants: Math.max(1, results.length),
    percentile: results.length ? Math.max(0, Math.round((1 - (rank - 1) / results.length) * 100)) : 100,
  };
}
