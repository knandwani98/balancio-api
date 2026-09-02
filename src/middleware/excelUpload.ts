import multer from "multer";
import type { NextFunction, Request, Response } from "express";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const name = file.originalname.toLowerCase();
    if (file.mimetype === XLSX_MIME || name.endsWith(".xlsx")) {
      cb(null, true);
      return;
    }
    cb(new Error("Only Excel (.xlsx) statements are supported"));
  },
}).single("file");

export function excelUploadMiddleware(req: Request, res: Response, next: NextFunction) {
  upload(req, res, (err: unknown) => {
    if (err) {
      const message = err instanceof Error ? err.message : "Could not upload file";
      res.status(400).json({ error: message });
      return;
    }
    next();
  });
}
