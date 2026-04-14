import { Request, Response, NextFunction } from "express";
import { z } from "zod";

export const validate =
  (schema: z.ZodTypeAny) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      const result = parsed as { body?: unknown; query?: unknown; params?: unknown };
      if (result.body) req.body = result.body;
      if (result.query) {
        Object.defineProperty(req, "query", {
          value: result.query,
          writable: true,
          configurable: true,
        });
      }
      if (result.params) {
        Object.defineProperty(req, "params", {
          value: result.params,
          writable: true,
          configurable: true,
        });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
