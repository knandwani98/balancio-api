declare module "pdf-parse" {
  function pdf(data: Buffer): Promise<{ text: string; numpages: number }>;
  export default pdf;
}
