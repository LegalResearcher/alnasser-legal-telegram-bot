import { readFileSync, writeFileSync } from "node:fs";

const [startPageArg, outputPath] = process.argv.slice(2);
const startPage = Number(startPageArg);

if (!Number.isInteger(startPage) || !outputPath) {
  throw new Error("الاستخدام: node scripts/extract-secondary-history-model.mjs <صفحة-بداية> <مسار-الناتج>");
}

const sourceDirectory = "/home/ubuntu/imports/secondary-history/pages";
const pagePath = page => `${sourceDirectory}/page-${String(page).padStart(2, "0")}.png`;
const imageContent = page => ({
  type: "image_url",
  image_url: { url: `data:image/png;base64,${readFileSync(pagePath(page)).toString("base64")}`, detail: "high" },
});

const schema = {
  name: "secondary_history_model",
  strict: true,
  schema: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            number: { type: "integer" },
            kind: { type: "string", enum: ["true_false", "multiple_choice"] },
            stem: { type: "string" },
            options: { type: "array", items: { type: "string" } },
            rawCorrectAnswer: { type: "integer" },
            needsReview: { type: "boolean" },
          },
          required: ["number", "kind", "stem", "options", "rawCorrectAnswer", "needsReview"],
          additionalProperties: false,
        },
      },
      sourceAnswerEncoding: { type: "string" },
      unresolvedNotes: { type: "array", items: { type: "string" } },
    },
    required: ["questions", "sourceAnswerEncoding", "unresolvedNotes"],
    additionalProperties: false,
  },
};

const response = await fetch(`${process.env.OPENAI_API_BASE}/chat/completions`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "gemini-3.1-pro-preview",
    max_tokens: 40000,
    response_format: { type: "json_schema", json_schema: schema },
    messages: [{
      role: "user",
      content: [
        {
          type: "text",
          text: `هذه ثلاث صفحات متتالية من نموذج تاريخ للثانوية العامة (القسم الأدبي). الصفحة الأولى والثانية تحتويان أسئلة النموذج 1 إلى 50، والصفحة الثالثة تحتوي مفتاح الإجابات المطبوع.

انسخ نص كل سؤال وخياراته كما يظهر بصريًا، من دون تصحيح لغوي أو حل السؤال من عندك. النموذج يحتوي 20 سؤال صح/خطأ ثم 30 سؤال اختيار من متعدد. في أسئلة الصح/الخطأ اكتب الخيارات بالترتيب ["ص", "خ"]، واربط rawCorrectAnswer برقم الإجابة في مفتاح الإجابة المطبوع فقط؛ الرقم 1 يعني الخيار الأول «ص» والرقم 2 يعني الخيار الثاني «خ». في الاختيار من متعدد اكتب الخيارات بالترتيب من 1 إلى 4 كما تظهر، واربط rawCorrectAnswer برقم الإجابة المطبوعة في مفتاح الإجابة فقط. لا تستنتج إجابة من معلوماتك التاريخية.

اجعل needsReview=true لأي سؤال أو خيار أو رقم إجابة غير مقروء، واكتب سبب ذلك في unresolvedNotes. الناتج JSON فقط وفق المخطط.`
        },
        imageContent(startPage),
        imageContent(startPage + 1),
        imageContent(startPage + 2),
      ],
    }],
  }),
});

if (!response.ok) {
  throw new Error(`فشل طلب نموذج الرؤية: ${response.status} ${await response.text()}`);
}

const answer = await response.json();
const payload = answer.choices[0]?.message?.content;
if (!payload) throw new Error("لم يُرجع نموذج الرؤية بيانات استخراج.");

writeFileSync(`${outputPath}.raw.json`, payload, "utf8");
const result = JSON.parse(payload);
writeFileSync(outputPath, JSON.stringify({ sourcePages: [startPage, startPage + 1, startPage + 2], ...result }, null, 2), "utf8");
console.log(JSON.stringify({ outputPath, questions: result.questions.length, needsReview: result.questions.filter(question => question.needsReview).length }, null, 2));
