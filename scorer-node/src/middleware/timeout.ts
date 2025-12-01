import type { NextFunction, Request, Response } from "express";

export function requestTimeout(timeoutMs: number) {
  return function requestTimeoutMiddleware(req: Request, res: Response, next: NextFunction) {
    const timer = setTimeout(() => {
      console.error("[timeout]", {
        route: req.path,
        method: req.method,
        requestId: res.locals?.requestId,
        userId: res.locals?.userId ?? null,
        timeoutMs,
      });
      if (!res.headersSent) {
        res.status(504).json({ error: "request_timeout" });
      }
    }, timeoutMs);

    const clear = () => clearTimeout(timer);
    res.on("finish", clear);
    res.on("close", clear);
    next();
  };
}
