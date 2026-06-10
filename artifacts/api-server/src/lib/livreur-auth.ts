import type { Request, Response, NextFunction } from "express";

export function livreurAuth(req: Request, res: Response, next: NextFunction) {
  const key = process.env.LIVREUR_API_KEY;
  if (!key) {
    next();
    return;
  }
  const provided = req.headers["x-api-key"] ?? req.headers["authorization"]?.replace(/^Bearer\s+/i, "");
  if (provided !== key) {
    res.status(401).json({ error: "Clé API invalide ou manquante", hint: "Ajouter le header: x-api-key: <LIVREUR_API_KEY>" });
    return;
  }
  next();
}
