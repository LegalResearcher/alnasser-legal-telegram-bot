import { readFileSync } from "node:fs";

const sourceDirectory = "/home/ubuntu/imports/secondary-history";
const failures = [];
const summary = [];

for (const index of [1, 2, 3, 4, 5, 6]) {
  const model = JSON.parse(readFileSync(`${sourceDirectory}/model-${index}-extracted.json`, "utf8"));
  const questions = model.questions;
  if (!Array.isArray(questions) || questions.length !== 50) failures.push(`النموذج ${index}: يجب أن يحتوي 50 سؤالًا.`);

  const numbers = questions.map(question => question.number).sort((left, right) => left - right);
  if (numbers.some((number, questionIndex) => number !== questionIndex + 1)) failures.push(`النموذج ${index}: تسلسل الأرقام غير مكتمل.`);

  const trueFalse = questions.filter(question => question.kind === "true_false");
  const multipleChoice = questions.filter(question => question.kind === "multiple_choice");
  if (trueFalse.length !== 20 || multipleChoice.length !== 30) failures.push(`النموذج ${index}: توزيع الأنواع ليس 20 صح/خطأ و30 اختيارًا.`);

  for (const question of questions) {
    const expectedOptions = question.kind === "true_false" ? 2 : 4;
    if (!question.stem?.trim() || question.options.length !== expectedOptions || question.options.some(option => !option.trim())) {
      failures.push(`النموذج ${index}: بيانات السؤال ${question.number} غير مكتملة.`);
    }
    if (!Number.isInteger(question.rawCorrectAnswer) || question.rawCorrectAnswer < 1 || question.rawCorrectAnswer > expectedOptions) {
      failures.push(`النموذج ${index}: مفتاح السؤال ${question.number} غير صالح.`);
    }
    if (question.needsReview) failures.push(`النموذج ${index}: السؤال ${question.number} موسوم للمراجعة.`);
  }

  summary.push({ model: index, questions: questions.length, trueFalse: trueFalse.length, multipleChoice: multipleChoice.length, needsReview: questions.filter(question => question.needsReview).length });
}

if (failures.length > 0) throw new Error(failures.join("\n"));
console.log(JSON.stringify({ models: summary.length, questions: summary.reduce((total, model) => total + model.questions, 0), summary }, null, 2));
