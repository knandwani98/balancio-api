import multer from "multer";
import type { Request } from "express";

export const statementUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const name = file.originalname.toLowerCase();
    if (file.mimetype === "application/pdf" || name.endsWith(".pdf")) {
      cb(null, true);
      return;
    }
    cb(new Error("Only PDF bank statements are supported"));
  },
}).single("file");
