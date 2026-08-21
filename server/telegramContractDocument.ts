import { AlignmentType, Document, ExternalHyperlink, Packer, Paragraph, TextRun } from "docx";
import type { TelegramContractTemplate, TelegramContractTemplateContentBlock } from "../drizzle/schema";

const LIBRARY_URL = "https://alnaseer.org/library";
const DOCX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function templateFileName(name: string): string {
  const cleaned = name
    .replace(/\.(?:docx?|pdf)$/i, "")
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${cleaned || "نموذج قانوني"}.docx`;
}

function contentParagraph(block: TelegramContractTemplateContentBlock): Paragraph {
  const text = block.text?.trim() ?? "";
  const number = block.num?.trim();
  return new Paragraph({
    alignment: AlignmentType.RIGHT,
    bidirectional: true,
    spacing: { after: 180, line: 330 },
    children: [
      ...(number ? [new TextRun({ text: `${number} `, bold: true, font: "Arial" })] : []),
      new TextRun({ text, font: "Arial", size: 24 }),
    ],
  });
}

export async function createTelegramContractDocument(template: Pick<TelegramContractTemplate, "fileName" | "content">): Promise<{
  filename: string;
  contentType: string;
  data: Uint8Array;
  caption: string;
}> {
  const content = Array.isArray(template.content) ? template.content : [];
  const document = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          bidirectional: true,
          spacing: { after: 360 },
          children: [new TextRun({ text: template.fileName, bold: true, size: 32, font: "Arial" })],
        }),
        ...content.map(contentParagraph),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          bidirectional: true,
          spacing: { before: 420 },
          children: [
            new TextRun({ text: "إعداد وتنسيق / ", italics: true, font: "Arial", size: 20 }),
            new ExternalHyperlink({
              link: LIBRARY_URL,
              children: [new TextRun({ text: "منصة الناصر القانونية", color: "0563C1", underline: {}, font: "Arial", size: 20 })],
            }),
          ],
        }),
      ],
    }],
  });
  const data = await Packer.toBuffer(document);
  return {
    filename: templateFileName(template.fileName),
    contentType: DOCX_CONTENT_TYPE,
    data: new Uint8Array(data),
    caption: `مستورد من مكتبة أ. معين الناصر\n${template.fileName}`,
  };
}
