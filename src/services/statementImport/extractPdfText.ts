import pdf from "pdf-parse";

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const result = await pdf(buffer);
  return result.text ?? "";
}
