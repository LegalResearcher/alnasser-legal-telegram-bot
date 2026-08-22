import type { TelegramExamQuestionForSession } from "./telegramExamDb";
import type { TelegramInlineKeyboard, TelegramLibraryStore, TelegramSender } from "./telegram";

export const CIVIL_LAW_EXAM_SUBJECT_KEY = "civil_law";
export const CIVIL_LAW_GENERAL_2025_SECTION_KEY = "general_2025";
export const CIVIL_LAW_GENERAL_2025_TITLE = "اختبار القانون المدني (القسم العام 2025)";
export const USUL_FIQH_EXAM_SUBJECT_KEY = "l1_usul_fiqh";
export const SECONDARY_EXAM_SUBJECT_KEY_PREFIX = "exam_secondary_";

export function isSecondaryExamSubjectKey(subjectKey: string): boolean {
  return subjectKey.startsWith(SECONDARY_EXAM_SUBJECT_KEY_PREFIX);
}

const importedSubjectKeys: Record<string, string> = {
  "l1:l1-usul": USUL_FIQH_EXAM_SUBJECT_KEY,
  "l1:l1-criminology": "l1_criminology",
  "l4:l4-civil-law": CIVIL_LAW_EXAM_SUBJECT_KEY,
  "secondary:math": "exam_secondary_math",
  "secondary:history": "exam_secondary_history",
  "secondary:arabic": "exam_secondary_arabic",
  "secondary:geography": "exam_secondary_geography",
  "secondary:quran": "exam_secondary_quran",
  "secondary:philosophy": "exam_secondary_philosophy",
  "secondary:islamic": "exam_secondary_islamic",
  "secondary:english": "exam_secondary_english",
};

export function getImportedExamSubjectKey(levelKey: string, catalogSubjectKey: string): string | undefined {
  const configuredKey = importedSubjectKeys[`${levelKey}:${catalogSubjectKey}`];
  if (configuredKey) return configuredKey;
  const level = getTelegramExamCatalogLevel(levelKey);
  const subject = getTelegramExamCatalogSubject(levelKey, catalogSubjectKey);
  if (!level || level.comingSoon || !subject) return undefined;
  return `exam_${levelKey}_${catalogSubjectKey.replace(/[^a-z0-9]+/gi, "_")}`;
}

export function getImportedExamCatalogLocation(subjectKey: string): { levelKey: string; catalogSubjectKey: string } | undefined {
  for (const level of TELEGRAM_EXAM_CATALOG) {
    for (const subject of level.subjects) {
      if (getImportedExamSubjectKey(level.key, subject.key) === subjectKey) return { levelKey: level.key, catalogSubjectKey: subject.key };
    }
  }
  return undefined;
}

export type TelegramExamCatalogSubject = {
  key: string;
  name: string;
  hasQuestions: boolean;
};

export type TelegramExamCatalogLevel = {
  key: string;
  name: string;
  subjects: TelegramExamCatalogSubject[];
  comingSoon?: boolean;
};

// هذا الفهرس يعكس ترتيب المستويات والمواد المعتمد في منصة الناصر. لا يتضمن استيراد أي أسئلة.
export const TELEGRAM_EXAM_CATALOG: TelegramExamCatalogLevel[] = [
  {
    key: "l1",
    name: "المستوى الأول",
    subjects: [
      { key: "l1-usul", name: "اصول الفقه", hasQuestions: true },
      { key: "l1-criminology", name: "علم الاجرام والعقاب", hasQuestions: true },
      { key: "l1-political-systems", name: "النظم السياسية", hasQuestions: false },
      { key: "l1-history-law", name: "تاريخ القانون وفلسفته", hasQuestions: false },
      { key: "l1-economics", name: "مبادئ الاقتصاد والاقتصاد الاسلامي", hasQuestions: false },
      { key: "l1-national-culture", name: "الثقافة الوطنية", hasQuestions: false },
      { key: "l1-worship", name: "فقه العبادات", hasQuestions: false },
      { key: "l1-computer", name: "حاسوب", hasQuestions: false },
      { key: "l1-fiqh-intro", name: "مدخل الفقه", hasQuestions: false },
      { key: "l1-arab-conflict", name: "الصراع العربي", hasQuestions: false },
      { key: "l1-arabic", name: "اللغة العربية", hasQuestions: false },
      { key: "l1-law-intro", name: "مدخل القانون", hasQuestions: false },
      { key: "l1-hadith", name: "مصطلح الحديث", hasQuestions: false },
      { key: "l1-legal-terms", name: "مصطلحات قانونية", hasQuestions: false },
    ],
  },
  {
    key: "l2",
    name: "المستوى الثاني",
    subjects: [
      { key: "l2-admin-law", name: "القانون الاداري", hasQuestions: false },
      { key: "l2-civil-law", name: "القانون المدني", hasQuestions: false },
      { key: "l2-arabic", name: "اللغة العربية", hasQuestions: false },
      { key: "l2-local-admin", name: "الادارة المحلية", hasQuestions: false },
      { key: "l2-money-banks", name: "نقود وبنوك", hasQuestions: false },
      { key: "l2-family", name: "احكام اسرة", hasQuestions: false },
      { key: "l2-organizations-rights", name: "منظمات وحقوق", hasQuestions: false },
      { key: "l2-penalties", name: "عقوبات", hasQuestions: false },
      { key: "l2-islamic-culture", name: "ثقافة اسلامية", hasQuestions: false },
      { key: "l2-usul", name: "اصول الفقة", hasQuestions: false },
      { key: "l2-international-law", name: "القانون الدولي", hasQuestions: false },
      { key: "l2-transactions", name: "فقه المعاملات", hasQuestions: false },
    ],
  },
  {
    key: "l3",
    name: "المستوى الثالث",
    subjects: [
      { key: "l3-admin-judiciary", name: "القضاء الاداري", hasQuestions: false },
      { key: "l3-civil-law", name: "قانون مدني", hasQuestions: false },
      { key: "l3-labor-law", name: "قانون العمل", hasQuestions: false },
      { key: "l3-commercial-law", name: "القانون التجاري", hasQuestions: false },
      { key: "l3-pleadings", name: "قانون المرافعات", hasQuestions: false },
      { key: "l3-inheritance", name: "مواريث", hasQuestions: false },
      { key: "l3-criminal-legislation", name: "التشريع الجنائي الأسلامي", hasQuestions: false },
      { key: "l3-sirah", name: "فقه السيرة", hasQuestions: false },
      { key: "l3-arabic", name: "اللغة العربية", hasQuestions: false },
      { key: "l3-maritime-air", name: "البحري والجوي", hasQuestions: false },
      { key: "l3-transactions", name: "فقة المعاملات", hasQuestions: false },
      { key: "l3-special-penalties", name: "قانون العقوبات الخاص", hasQuestions: false },
      { key: "l3-usul", name: "اصول الفقة", hasQuestions: false },
    ],
  },
  {
    key: "l4",
    name: "المستوى الرابع",
    subjects: [
      { key: "l4-commercial-law", name: "القانون التجاري", hasQuestions: false },
      { key: "l4-compulsory-execution", name: "التنفيذ الجبري", hasQuestions: false },
      { key: "l4-usul", name: "أصول الفقه", hasQuestions: false },
      { key: "l4-judiciary-proof", name: "القضاء والإثبات الشرعي", hasQuestions: false },
      { key: "l4-private-international", name: "القانون الدولي الخاص - الجنسية", hasQuestions: false },
      { key: "l4-interpretation", name: "تفسير الآيات وأحاديث الأحكام", hasQuestions: false },
      { key: "l4-will-waqf", name: "الوصية والوقف الشرعي", hasQuestions: false },
      { key: "l4-conflict-laws", name: "تنازع القوانين والاختصاص القضائي الدولي", hasQuestions: false },
      { key: "l4-finance-tax", name: "المالية العامة والتشريع الضريبي", hasQuestions: false },
      { key: "l4-criminal-procedure", name: "قانون الإجراءات الجزائية", hasQuestions: false },
      { key: "l4-civil-law", name: "القانون المدني", hasQuestions: true },
      { key: "l4-arabic", name: "اللغة العربية", hasQuestions: false },
      { key: "l4-research-methods", name: "مناهج البحث", hasQuestions: false },
    ],
  },
  {
    key: "secondary",
    name: "اختبارات الثانوية العامة",
    subjects: [
      { key: "math", name: "الرياضيات", hasQuestions: true },
      { key: "history", name: "التاريخ", hasQuestions: true },
      { key: "arabic", name: "اللغة العربية", hasQuestions: true },
      { key: "geography", name: "الجغرافيا", hasQuestions: true },
      { key: "quran", name: "القرآن الكريم", hasQuestions: true },
      { key: "philosophy", name: "الفلسفة والمنطق وعلم النفس", hasQuestions: true },
      { key: "islamic", name: "التربية الإسلامية", hasQuestions: true },
      { key: "english", name: "اللغة الإنجليزية", hasQuestions: true },
    ],
  },
  {
    key: "judicial-academic",
    name: "بوابة التأهيل القضائي والأكاديمي",
    subjects: [],
    comingSoon: true,
  },
];

export function getTelegramExamCatalogLevel(levelKey: string): TelegramExamCatalogLevel | undefined {
  return TELEGRAM_EXAM_CATALOG.find(level => level.key === levelKey);
}

export function getTelegramExamCatalogSubject(levelKey: string, subjectKey: string): TelegramExamCatalogSubject | undefined {
  return getTelegramExamCatalogLevel(levelKey)?.subjects.find(subject => subject.key === subjectKey);
}

export function examSubjectHeading(levelKey: string, subject: TelegramExamCatalogSubject): string {
  if (levelKey !== "secondary") return subject.name;
  const academicYear = subject.key === "math" || subject.key === "history" ? "2023م" : "2025—2026م";
  return `نماذج أوائل الجمهورية اليمنية مادة ${subject.name} للعام الدراسي ${academicYear}`;
}

export function civilLawExamMenu(): TelegramInlineKeyboard {
  return examLevelsMenu();
}

export function examLevelsMenu(): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      ...TELEGRAM_EXAM_CATALOG.map(level => [{ text: level.name, callback_data: `exam:level:${level.key}` }]),
      [{ text: "القائمة الرئيسة", callback_data: "menu" }],
    ],
  };
}

export function examSubjectsMenu(levelKey: string, requestedPage = 1): TelegramInlineKeyboard {
  const level = getTelegramExamCatalogLevel(levelKey);
  if (!level) return examLevelsMenu();
  if (level.comingSoon) {
    return {
      inline_keyboard: [
        [{ text: "قريبًا", callback_data: `exam:coming-soon:${level.key}` }],
        [{ text: "رجوع إلى المستويات", callback_data: "exam:levels" }],
      ],
    };
  }
  const pageSize = 7;
  const totalPages = Math.max(1, Math.ceil(level.subjects.length / pageSize));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const pageSubjects = level.subjects.slice((page - 1) * pageSize, page * pageSize);
  const rows: TelegramInlineKeyboard["inline_keyboard"] = pageSubjects.map(subject => [
    { text: subject.name, callback_data: `exam:subject:${levelKey}:${subject.key}:${page}` },
  ]);
  if (totalPages > 1) {
    rows.push([
      ...(page > 1 ? [{ text: "السابق", callback_data: `exam:level:${levelKey}:${page - 1}` }] : []),
      { text: `${page}/${totalPages}`, callback_data: "exam:noop" },
      ...(page < totalPages ? [{ text: "التالي", callback_data: `exam:level:${levelKey}:${page + 1}` }] : []),
    ]);
  }
  rows.push([{ text: "رجوع إلى المستويات", callback_data: "exam:levels" }]);
  return { inline_keyboard: rows };
}

type ExamFormMenuItem = { formKey: string; formName: string; sortOrder?: number; questionCount?: number };

function isAnnualExamForm(form: ExamFormMenuItem): boolean {
  if (/^Model_/i.test(form.formKey)) return false;
  if (/^secondary_[a-z0-9_]+_model_\d+$/i.test(form.formKey)) return true;
  return /\b20\d{2}\b/.test(form.formName);
}

function annualFormSort(left: ExamFormMenuItem, right: ExamFormMenuItem): number {
  if (/^secondary_[a-z0-9_]+_model_\d+$/i.test(left.formKey) || /^secondary_[a-z0-9_]+_model_\d+$/i.test(right.formKey)) {
    return (left.sortOrder ?? 0) - (right.sortOrder ?? 0);
  }
  const leftYear = Number(left.formName.match(/20\d{2}/)?.[0] ?? 9999);
  const rightYear = Number(right.formName.match(/20\d{2}/)?.[0] ?? 9999);
  if (leftYear !== rightYear) return leftYear - rightYear;
  const priority = (name: string) => name.includes("العام") ? 1 : name.includes("الموازي") ? 2 : name.includes("المختلط") ? 3 : 4;
  return priority(left.formName) - priority(right.formName) || left.formName.localeCompare(right.formName, "ar");
}

function annualFormDisplayName(form: ExamFormMenuItem): string {
  const year = form.formName.match(/20\d{2}/)?.[0];
  if (!year) return form.formName;
  const type = form.formName.includes("العام") ? "العام" : form.formName.includes("الموازي") ? "الموازي" : form.formName.includes("المختلط") ? "المختلط" : form.formName.replace(year, "").trim();
  return `${year} ${type}`.trim();
}

function pagedFormsMenu(
  levelKey: string,
  subjectKey: string,
  forms: ExamFormMenuItem[],
  requestedPage: number,
  navigationPrefix: "exam:forms" | "exam:training",
  includeTrainingButton: boolean
): TelegramInlineKeyboard {
  const pageSize = 7;
  const totalPages = Math.max(1, Math.ceil(forms.length / pageSize));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const pageForms = forms.slice((page - 1) * pageSize, page * pageSize);
  const rows: TelegramInlineKeyboard["inline_keyboard"] = pageForms.map(form => [
    {
      text: `${isAnnualExamForm(form) ? annualFormDisplayName(form) : form.formName}${form.questionCount === 0 ? " ⏳" : ""}`,
      callback_data: `exam:form:${levelKey}:${subjectKey}:${form.sortOrder}:${page}`,
    },
  ]);
  if (totalPages > 1) {
    rows.push([
      ...(page > 1 ? [{ text: "السابق", callback_data: `${navigationPrefix}:${levelKey}:${subjectKey}:${page - 1}` }] : []),
      { text: `${page}/${totalPages}`, callback_data: "exam:noop" },
      ...(page < totalPages ? [{ text: "التالي", callback_data: `${navigationPrefix}:${levelKey}:${subjectKey}:${page + 1}` }] : []),
    ]);
  }
  if (includeTrainingButton) rows.push([{ text: "🧪 أسئلة تجريبية", callback_data: `exam:training:${levelKey}:${subjectKey}:1` }]);
  rows.push([{ text: "رجوع إلى المواد", callback_data: `exam:level:${levelKey}` }]);
  return { inline_keyboard: rows };
}

export function examFormsMenu(levelKey: string, subjectKey: string, forms: ExamFormMenuItem[], requestedPage = 1): TelegramInlineKeyboard {
  return pagedFormsMenu(levelKey, subjectKey, forms.filter(isAnnualExamForm).sort(annualFormSort), requestedPage, "exam:forms", forms.some(form => !isAnnualExamForm(form)));
}

export function examTrainingFormsMenu(levelKey: string, subjectKey: string, forms: ExamFormMenuItem[], requestedPage = 1): TelegramInlineKeyboard {
  return pagedFormsMenu(
    levelKey,
    subjectKey,
    forms.filter(form => !isAnnualExamForm(form)).sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0)),
    requestedPage,
    "exam:training",
    false
  );
}

export function civilLawExamSectionMenu(): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      [{ text: "القسم العام 2025", callback_data: "exam:civil:general2025" }],
      [{ text: "رجوع إلى مواد المستوى الرابع", callback_data: "exam:level:l4" }],
    ],
  };
}

export function civilLawExamTimeMenu(): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: "15 ثانية لكل سؤال", callback_data: "exam:time:15" },
        { text: "30 ثانية لكل سؤال", callback_data: "exam:time:30" },
      ],
      [
        { text: "دقيقة لكل سؤال", callback_data: "exam:time:60" },
        { text: "5 دقائق لكل سؤال", callback_data: "exam:time:300" },
      ],
      [{ text: "رجوع إلى القانون المدني", callback_data: "exam:civil" }],
    ],
  };
}

export function examTimeMenu(levelKey: string, subjectKey: string, formSortOrder: number, backCallback: string): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: "15 ثانية لكل سؤال", callback_data: `exam:time:${levelKey}:${subjectKey}:${formSortOrder}:15` },
        { text: "30 ثانية لكل سؤال", callback_data: `exam:time:${levelKey}:${subjectKey}:${formSortOrder}:30` },
      ],
      [
        { text: "دقيقة لكل سؤال", callback_data: `exam:time:${levelKey}:${subjectKey}:${formSortOrder}:60` },
        { text: "5 دقائق لكل سؤال", callback_data: `exam:time:${levelKey}:${subjectKey}:${formSortOrder}:300` },
      ],
      [{ text: "رجوع إلى النماذج", callback_data: backCallback }],
    ],
  };
}

export function civilLawExamReadyMenu(sessionId: number): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      [{ text: "أنا مستعد!", callback_data: `exam:ready:${sessionId}` }],
      [{ text: "إيقاف الاختبار", callback_data: `exam:stop:${sessionId}` }],
    ],
  };
}

export function formatExamTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return minutes > 0 ? `${minutes} د ${remainder} ث` : `${remainder} ث`;
}

export function optionText(question: TelegramExamQuestionForSession, option: "A" | "B" | "C" | "D"): string {
  return option === "A" ? question.optionA : option === "B" ? question.optionB : option === "C" ? question.optionC : question.optionD;
}

export function examPollOptionText(subjectKey: string, option: "A" | "B" | "C" | "D", text: string): string {
  if (!isSecondaryExamSubjectKey(subjectKey)) return text;
  if (option === "A" && text.trim() === "ص") return "الإجابة صحيحة";
  if (option === "B" && text.trim() === "خ") return "الإجابة خاطئة";
  return text;
}

export function optionLabel(option: "A" | "B" | "C" | "D"): string {
  return option === "A" ? "أ" : option === "B" ? "ب" : option === "C" ? "ج" : "د";
}

function isWrittenExamQuestion(question: TelegramExamQuestionForSession): boolean {
  return [question.optionA, question.optionB, question.optionC, question.optionD].every(option => !option.trim());
}

function writtenQuestionMenu(sessionId: number): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      [{ text: "إنهاء الاختبار", callback_data: `exam:written-next:${sessionId}` }],
      [{ text: "إيقاف الاختبار", callback_data: `exam:stop:${sessionId}` }],
    ],
  };
}

export async function sendExamQuestion(chatId: number, sessionId: number, telegramUserId: string, store: TelegramLibraryStore, sender: TelegramSender): Promise<void> {
  const session = await store.getExamSession(sessionId, telegramUserId);
  if (!session || session.status !== "active") {
    await sender.sendMessage(chatId, "لا توجد جلسة اختبار نشطة. يمكنك بدء اختبار جديد من القسم العام 2025.", civilLawExamTimeMenu());
    return;
  }
  const questions = await store.listExamQuestions(session.subjectKey, session.sectionKey);
  const question = questions[session.questionIndex];
  if (!question) {
    await sender.sendMessage(chatId, "تعذر تحميل سؤال الاختبار الحالي. حاول بدء اختبار جديد.", civilLawExamTimeMenu());
    return;
  }
  if (isWrittenExamQuestion(question)) {
    await sender.sendMessage(
      chatId,
      `[${session.questionIndex + 1}/${questions.length}] ${question.questionText}`,
      writtenQuestionMenu(sessionId)
    );
    return;
  }
  const openPeriodSeconds = [15, 30, 60, 300].includes(session.timeLimitSeconds)
    ? session.timeLimitSeconds as 15 | 30 | 60 | 300
    : 30;
  const pollOptions = [
    { key: "A" as const, text: examPollOptionText(session.subjectKey, "A", question.optionA) },
    { key: "B" as const, text: examPollOptionText(session.subjectKey, "B", question.optionB) },
    { key: "C" as const, text: examPollOptionText(session.subjectKey, "C", question.optionC) },
    { key: "D" as const, text: examPollOptionText(session.subjectKey, "D", question.optionD) },
  ].filter(option => option.text.trim().length > 0);
  const correctOptionIndex = pollOptions.findIndex(option => option.key === question.correctOption);
  if (pollOptions.length < 2 || correctOptionIndex < 0) {
    await sender.sendMessage(chatId, "تعذر إعداد خيارات هذا السؤال للاختبار. يمكنك بدء جولة جديدة.", civilLawExamMenu());
    return;
  }
  const poll = await sender.sendQuizPoll(chatId, {
    question: `[${session.questionIndex + 1}/${questions.length}] ${question.questionText}`,
    options: pollOptions.map(option => option.text),
    correctOptionIndex,
    explanation: isSecondaryExamSubjectKey(session.subjectKey) ? "" : "📖 سيظهر الشرح المفصل بعد الإجابة، ويظهر التلميح عند الإجابة الخاطئة.",
    openPeriodSeconds,
  });
  const linked = await store.setExamActivePoll({ sessionId, telegramUserId, questionIndex: session.questionIndex, pollId: poll.pollId });
  if (!linked) {
    await sender.sendMessage(chatId, "تعذر ربط سؤال الاختبار الحالي. يمكنك إعادة بدء الاختبار.", civilLawExamTimeMenu());
  }
}
