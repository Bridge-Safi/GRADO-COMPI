import { Router } from "express";
import { db, playersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { emitEvent } from "../lib/event-bus";

const router = Router();

// Decode JWT payload without verification (Clerk token, same-domain trust)
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], "base64url").toString("utf-8");
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractPhone(payload: Record<string, unknown>): string | null {
  // Clerk stores phone in phone_numbers array or primary_phone_number
  const phone = payload.phone_number ?? payload.phone ?? payload.primary_phone_number;
  if (typeof phone === "string") return phone;
  const phones = payload.phone_numbers;
  if (Array.isArray(phones) && phones.length > 0) {
    const first = phones[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object" && typeof (first as Record<string, unknown>).phone_number === "string") {
      return (first as Record<string, unknown>).phone_number as string;
    }
  }
  return null;
}

function getPlayerIdentifier(req: import("express").Request): { phone?: string; clerkId?: string } | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  const phone = extractPhone(payload);
  const clerkId = typeof payload.sub === "string" ? payload.sub : undefined;
  return { phone: phone ?? undefined, clerkId };
}

// GET /game/diamonds — get player diamond balance
router.get("/diamonds", async (req, res) => {
  const identity = getPlayerIdentifier(req);

  // Also support direct phone param for game.safi-bridge.ma
  const phoneParam = req.query.phone as string | undefined;
  const phone = phoneParam ?? identity?.phone;

  if (!phone) {
    res.json({ diamonds: 0, score: 0, gamesPlayed: 0 });
    return;
  }

  const normalised = phone.replace(/\s+/g, "").replace(/^00/, "+");

  const [player] = await db
    .select({
      id: playersTable.id,
      diamonds: playersTable.diamonds,
      score: playersTable.score,
      gamesPlayed: playersTable.gamesPlayed,
      pseudo: playersTable.pseudo,
    })
    .from(playersTable)
    .where(eq(playersTable.phone, normalised))
    .limit(1);

  if (!player) {
    res.json({ diamonds: 0, score: 0, gamesPlayed: 0 });
    return;
  }

  res.json({
    playerId: player.id,
    pseudo: player.pseudo,
    diamonds: player.diamonds,
    score: player.score,
    gamesPlayed: player.gamesPlayed,
  });
});

// POST /game/diamonds/spend — deduct diamonds (used at checkout)
router.post("/diamonds/spend", async (req, res) => {
  const identity = getPlayerIdentifier(req);
  const phoneParam = req.query.phone as string | undefined;
  const phone = phoneParam ?? identity?.phone;
  const spend = Number(req.body?.spend ?? 0);

  if (!phone || spend <= 0) {
    res.status(400).json({ error: "phone et spend requis" });
    return;
  }

  const normalised = phone.replace(/\s+/g, "").replace(/^00/, "+");

  const [player] = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.phone, normalised))
    .limit(1);

  if (!player) {
    res.status(404).json({ error: "Joueur introuvable" });
    return;
  }

  const newDiamonds = Math.max(0, player.diamonds - spend);

  const [updated] = await db
    .update(playersTable)
    .set({ diamonds: newDiamonds, updatedAt: new Date() })
    .where(eq(playersTable.id, player.id))
    .returning();

  emitEvent("player:updated", {
    id: updated.id,
    pseudo: updated.pseudo,
    diamonds: updated.diamonds,
    score: updated.score,
    action: "spend",
  });

  res.json({ diamonds: updated.diamonds, spent: spend });
});

// POST /game/score — update score + earn diamonds (called by game.safi-bridge.ma)
router.post("/score", async (req, res) => {
  const { phone, score, diamonds, gamesPlayed } = req.body as {
    phone?: string;
    score?: number;
    diamonds?: number;
    gamesPlayed?: number;
  };

  if (!phone) {
    res.status(400).json({ error: "phone requis" });
    return;
  }

  const normalised = phone.replace(/\s+/g, "").replace(/^00/, "+");

  const [player] = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.phone, normalised))
    .limit(1);

  if (!player) {
    res.status(404).json({ error: "Joueur introuvable" });
    return;
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof score === "number") updates.score = sql`${playersTable.score} + ${score}`;
  if (typeof diamonds === "number") updates.diamonds = sql`${playersTable.diamonds} + ${diamonds}`;
  if (typeof gamesPlayed === "number") updates.gamesPlayed = sql`${playersTable.gamesPlayed} + ${gamesPlayed}`;

  const [updated] = await db
    .update(playersTable)
    .set(updates)
    .where(eq(playersTable.id, player.id))
    .returning();

  emitEvent("player:updated", {
    id: updated.id,
    pseudo: updated.pseudo,
    diamonds: updated.diamonds,
    score: updated.score,
    gamesPlayed: updated.gamesPlayed,
    action: "score",
  });

  res.json({
    playerId: updated.id,
    pseudo: updated.pseudo,
    diamonds: updated.diamonds,
    score: updated.score,
    gamesPlayed: updated.gamesPlayed,
  });
});

// POST /game/online — marquer joueur connecté au jeu
router.post("/online", async (req, res) => {
  const { phone, isOnline } = req.body as { phone?: string; isOnline?: boolean };
  if (!phone) { res.status(400).json({ error: "phone requis" }); return; }

  const normalised = phone.replace(/\s+/g, "").replace(/^00/, "+");

  const [updated] = await db
    .update(playersTable)
    .set({
      isOnline: isOnline !== false,
      lastSeenAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(playersTable.phone, normalised))
    .returning();

  if (!updated) { res.status(404).json({ error: "Joueur introuvable" }); return; }

  emitEvent(isOnline !== false ? "player:online" : "player:updated", {
    id: updated.id,
    pseudo: updated.pseudo,
    isOnline: updated.isOnline,
  });

  res.json({ ok: true, isOnline: updated.isOnline });
});

export default router;
