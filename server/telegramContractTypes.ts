import type { TelegramContractTemplateType } from "../drizzle/schema";

export const TELEGRAM_CONTRACT_TYPE_LABELS: Record<TelegramContractTemplateType, string> = {
  civil: "عقود مدنية",
  commercial: "عقود تجارية",
  labor: "عقود عمالية",
  personal: "أحوال شخصية ومواريث",
  judicial: "صيغ قضائية",
  general: "صيغ عامة ومتنوعة",
};

function normalizedContractName(fileName: string): string {
  return fileName
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ـ]/g, "")
    .replace(/[^\u0621-\u063A\u0641-\u064A0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyTelegramContractTemplate(fileName: string): TelegramContractTemplateType {
  const name = normalizedContractName(fileName);
  if (/(تجاري|محل|صرافه|بالعمول|شركه|اسهم|حصص|السجل التجاري|وكاله اجنبيه|مؤسسه|علامه تجاريه|ضمانه تجاريه|ضمان تجاري|مضارب)/.test(name)) return "commercial";
  if (/(عمل|اجير|وظيفه|راتب|عامل|عهدة|عهد)/.test(name)) return "labor";
  if (/(قضيه|شكوي|ديات|اروش|قصاص|مروري|دعوي|خصومه|تحكيم)/.test(name)) return "judicial";
  if (/(سفر|جواز|هبه|وصيه|وقف|وريث|ورثه|قسمه)/.test(name)) return "personal";
  if (/(بناء|شقه|ارض|بيع|ايجار|وكاله|رهن|كفال|دين|قرض|حواله|تنازل|صلح|مقاوله|مقايضه|اقاله|اطلاق)/.test(name)) return "civil";
  return "general";
}
