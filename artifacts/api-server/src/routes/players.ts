import { Router } from "express";
import { db, playersTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { emitEvent } from "../lib/event-bus";

const router = Router();

const MENU_COST = 60000;
const DIAMONDS_TO_MAD = 1000;

// GET /players
router.get("/", async (_req, res) => {
  const rows = await db
    .select()
    .from(playersTable)
    .orderBy(desc(playersTable.score));
  res.json(rows.map(fmt));
});

// GET /players/leaderboard
router.get("/leaderboard", async (_req, res) => {
  const rows = await db
    .select()
    .from(playersTable)
    .orderBy(desc(playersTable.score))
    .limit(50);
  res.json(rows.map((p, i) => ({ ...fmt(p), rank: i + 1 })));
});

// GET /players/online
router.get("/online", async (_req, res) => {
  const rows = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.isOnline, true))
    .orderBy(desc(playersTable.lastSeenAt));
  res.json(rows.map(fmt));
});

// GET /players/payment-summary — who owes what
router.get("/payment-summary", async (_req, res) => {
  const players = await db.select().from(playersTable).orderBy(desc(playersTable.diamonds));

  const ready: ReturnType<typeof fmt>[] = [];
  const owes10k: ReturnType<typeof fmt>[] = [];
  const owes20k: ReturnType<typeof fmt>[] = [];
  const owes30k: ReturnType<typeof fmt>[] = [];
  const owes40k: ReturnType<typeof fmt>[] = [];
  const owes50k: ReturnType<typeof fmt>[] = [];
  const owesMore: ReturnType<typeof fmt>[] = [];

  for (const p of players) {
    const missing = Math.max(0, MENU_COST - p.diamonds);
    const amountMAD = Math.ceil(missing / DIAMONDS_TO_MAD);
    const enriched = { ...fmt(p), missing, amountMAD };
    if (missing === 0) ready.push(enriched);
    else if (missing <= 10000) owes10k.push(enriched);
    else if (missing <= 20000) owes20k.push(enriched);
    else if (missing <= 30000) owes30k.push(enriched);
    else if (missing <= 40000) owes40k.push(enriched);
    else if (missing <= 50000) owes50k.push(enriched);
    else owesMore.push(enriched);
  }

  res.json({
    menuCost: MENU_COST,
    diamondsToMAD: DIAMONDS_TO_MAD,
    totalPlayers: players.length,
    ready,
    owes10k,
    owes20k,
    owes30k,
    owes40k,
    owes50k,
    owesMore,
  });
});

// POST /players
router.post("/", async (req, res) => {
  const { pseudo, phone, email, address, profilePhoto, diamonds, score, gamesPlayed } = req.body as Record<string, string | number>;
  if (!pseudo || !phone) {
    res.status(400).json({ error: "pseudo et phone sont requis" });
    return;
  }
  const [player] = await db
    .insert(playersTable)
    .values({
      pseudo: String(pseudo),
      phone: String(phone),
      email: email ? String(email) : null,
      address: address ? String(address) : null,
      profilePhoto: profilePhoto ? String(profilePhoto) : null,
      diamonds: diamonds ? Number(diamonds) : 0,
      score: score ? Number(score) : 0,
      gamesPlayed: gamesPlayed ? Number(gamesPlayed) : 0,
    })
    .onConflictDoUpdate({
      target: playersTable.phone,
      set: {
        pseudo: String(pseudo),
        address: address ? String(address) : null,
        profilePhoto: profilePhoto ? String(profilePhoto) : null,
        diamonds: diamonds ? Number(diamonds) : 0,
        score: score ? Number(score) : 0,
        gamesPlayed: gamesPlayed ? Number(gamesPlayed) : 0,
        updatedAt: new Date(),
      },
    })
    .returning();
  emitEvent("player:created", {
    id: player.id,
    pseudo: player.pseudo,
    diamonds: player.diamonds,
    score: player.score,
  });

  res.status(201).json(fmt(player));
});

// PATCH /players/:id
router.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { pseudo, address, profilePhoto, diamonds, score, gamesPlayed, isOnline } = req.body as Record<string, string | number | boolean>;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (pseudo !== undefined) updates.pseudo = pseudo;
  if (address !== undefined) updates.address = address;
  if (profilePhoto !== undefined) updates.profilePhoto = profilePhoto;
  if (diamonds !== undefined) updates.diamonds = Number(diamonds);
  if (score !== undefined) updates.score = Number(score);
  if (gamesPlayed !== undefined) updates.gamesPlayed = Number(gamesPlayed);
  if (isOnline !== undefined) {
    updates.isOnline = isOnline;
    if (isOnline) updates.lastSeenAt = new Date();
  }

  const [updated] = await db
    .update(playersTable)
    .set(updates)
    .where(eq(playersTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Joueur non trouvé" });
    return;
  }

  emitEvent("player:updated", {
    id: updated.id,
    pseudo: updated.pseudo,
    diamonds: updated.diamonds,
    score: updated.score,
    isOnline: updated.isOnline,
  });

  res.json(fmt(updated));
});

// DELETE /players/:id
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(playersTable).where(eq(playersTable.id, id));
  emitEvent("player:deleted", { id });
  res.json({ ok: true });
});

// PATCH /players/:id/ping — mark player online
router.patch("/:id/ping", async (req, res) => {
  const id = Number(req.params.id);
  const [updated] = await db
    .update(playersTable)
    .set({ isOnline: true, lastSeenAt: new Date(), updatedAt: new Date() })
    .where(eq(playersTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Joueur non trouvé" });
    return;
  }

  emitEvent("player:online", {
    id: updated.id,
    pseudo: updated.pseudo,
    isOnline: true,
  });

  res.json(fmt(updated));
});

// GET /players/stats
router.get("/stats", async (_req, res) => {
  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      online: sql<number>`count(*) filter (where is_online = true)::int`,
      ready: sql<number>`count(*) filter (where diamonds >= ${MENU_COST})::int`,
      totalDiamonds: sql<number>`coalesce(sum(diamonds), 0)::int`,
    })
    .from(playersTable);

  res.json({
    total: counts?.total ?? 0,
    online: counts?.online ?? 0,
    ready: counts?.ready ?? 0,
    notReady: (counts?.total ?? 0) - (counts?.ready ?? 0),
    totalDiamonds: counts?.totalDiamonds ?? 0,
    menuCost: MENU_COST,
  });
});

function fmt(p: typeof playersTable.$inferSelect) {
  const missing = Math.max(0, MENU_COST - p.diamonds);
  return {
    ...p,
    missing,
    amountMAD: Math.ceil(missing / DIAMONDS_TO_MAD),
    lastSeenAt: p.lastSeenAt ? p.lastSeenAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export default router;
