import { readFileSync } from "node:fs";
import mysql from "mysql2/promise";

const subjectKey = "exam_secondary_math";
const sourceDirectory = "/home/ubuntu/imports/secondary-math";
const modelFiles = [1, 2, 3, 4].map(index => `${sourceDirectory}/model-${index}-extracted.json`);

const letterFor = answerIndex => ["A", "B", "C", "D"][answerIndex - 1];

function formNameFor(index) {
  return `النموذج ${["الأول", "الثاني", "الثالث", "الرابع"][index - 1]} — رياضيات أدبي`;
}

function loadModels() {
  return modelFiles.map((path, index) => {
    const extracted = JSON.parse(readFileSync(path, "utf8"));
    const questions = extracted.questions;
    if (!Array.isArray(questions) || questions.length !== 40) {
      throw new Error(`النموذج ${index + 1} لا يحتوي أربعين سؤالًا مكتملًا.`);
    }
    const numbers = questions.map(question => question.number).sort((left, right) => left - right);
    if (numbers.some((number, questionIndex) => number !== questionIndex + 1)) {
      throw new Error(`ترقيم أسئلة النموذج ${index + 1} غير مكتمل أو مكرر.`);
    }
    return { index: index + 1, questions };
  });
}

async function importExams() {
  const models = loadModels();
  if (!process.env.DATABASE_URL) throw new Error("قاعدة بيانات البوت غير متاحة.");
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    await connection.beginTransaction();
    await connection.execute("UPDATE telegram_exam_forms SET isActive = 0 WHERE subjectKey = ?", [subjectKey]);
    await connection.execute("UPDATE telegram_exam_questions SET isActive = 0 WHERE subjectKey = ?", [subjectKey]);

    for (const model of models) {
      const formKey = `secondary_math_model_${model.index}`;
      await connection.execute(
        `INSERT INTO telegram_exam_forms (subjectKey, formKey, formName, sortOrder, isActive)
         VALUES (?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE formName = VALUES(formName), sortOrder = VALUES(sortOrder), isActive = 1`,
        [subjectKey, formKey, formNameFor(model.index), model.index]
      );

      for (const question of model.questions) {
        const optionCount = question.kind === "true_false" ? 2 : 4;
        const correctOption = letterFor(question.rawCorrectAnswer);
        if (!correctOption || question.rawCorrectAnswer > optionCount || !question.stem?.trim()) {
          throw new Error(`بيانات السؤال ${question.number} في النموذج ${model.index} غير صالحة.`);
        }
        const options = [...question.options, "", "", "", ""].slice(0, 4);
        await connection.execute(
          `INSERT INTO telegram_exam_questions
           (sourceQuestionId, subjectKey, sectionKey, questionText, optionA, optionB, optionC, optionD, correctOption, explanation, hint, sortOrder, isActive)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 1)
           ON DUPLICATE KEY UPDATE
             subjectKey = VALUES(subjectKey), sectionKey = VALUES(sectionKey), questionText = VALUES(questionText),
             optionA = VALUES(optionA), optionB = VALUES(optionB), optionC = VALUES(optionC), optionD = VALUES(optionD),
             correctOption = VALUES(correctOption), explanation = VALUES(explanation), hint = NULL,
             sortOrder = VALUES(sortOrder), isActive = 1`,
          [
            `secondary_math_model_${model.index}_q${question.number}`,
            subjectKey,
            formKey,
            question.stem,
            options[0], options[1], options[2], options[3],
            correctOption,
            "📖 الإجابة الصحيحة وفق مفتاح الإجابة المطبوع في النموذج المرفق.",
            question.number,
          ]
        );
      }
    }
    await connection.commit();
    console.log(JSON.stringify({ subjectKey, forms: models.length, questions: models.length * 40 }, null, 2));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

importExams().catch(error => {
  console.error(`فشل استيراد نماذج رياضيات الثانوية: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
