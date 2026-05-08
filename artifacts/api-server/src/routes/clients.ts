import { Router } from "express";
import { db, clientsTable, ordersTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";

const router = Router();

const fmt = (c: typeof clientsTable.$inferSelect) => ({
  ...c,
  createdAt: c.createdAt.toISOString(),
  updatedAt: c.updatedAt.toISOString(),
});

// GET /clients — list all clients with computed order stats
router.get("/", async (_req, res) => {
  const clients = await db.select().from(clientsTable).orderBy(desc(clientsTable.createdAt));

  const stats = await db
    .select({
      phone: ordersTable.customerPhone,
      totalOrders: sql<number>`count(*)::int`,
      totalSpent: sql<number>`coalesce(sum(total_amount), 0)::real`,
      lastOrderAt: sql<string>`max(created_at)::text`,
    })
    .from(ordersTable)
    .groupBy(ordersTable.customerPhone);

  const statsMap = new Map(stats.map((s) => [s.phone, s]));

  res.json(
    clients.map((c) => {
      const s = statsMap.get(c.phone);
      return {
        ...fmt(c),
        totalOrders: s?.totalOrders ?? 0,
        totalSpent: s?.totalSpent ?? 0,
        lastOrderAt: s?.lastOrderAt ?? null,
      };
    })
  );
});

// GET /clients/from-orders — auto-generate client list from order history
router.get("/from-orders", async (_req, res) => {
  const rows = await db
    .select({
      phone: ordersTable.customerPhone,
      name: ordersTable.customerName,
      address: ordersTable.deliveryAddress,
      totalOrders: sql<number>`count(*)::int`,
      totalSpent: sql<number>`coalesce(sum(total_amount), 0)::real`,
      lastOrderAt: sql<string>`max(${ordersTable.createdAt})::text`,
    })
    .from(ordersTable)
    .groupBy(ordersTable.customerPhone, ordersTable.customerName, ordersTable.deliveryAddress)
    .orderBy(desc(sql`count(*)`));

  res.json(rows);
});

// GET /clients/stats — aggregate stats
router.get("/stats", async (_req, res) => {
  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      vip: sql<number>`count(*) filter (where is_vip = true)::int`,
    })
    .from(clientsTable);

  const [orderStats] = await db
    .select({
      uniqueCustomers: sql<number>`count(distinct customer_phone)::int`,
      totalRevenue: sql<number>`coalesce(sum(total_amount), 0)::real`,
    })
    .from(ordersTable);

  res.json({
    total: counts?.total ?? 0,
    vip: counts?.vip ?? 0,
    uniqueCustomers: orderStats?.uniqueCustomers ?? 0,
    totalRevenue: orderStats?.totalRevenue ?? 0,
  });
});

// POST /clients — create client manually
router.post("/", async (req, res) => {
  const { name, phone, email, address, notes, isVip } = req.body as Record<string, string | boolean>;
  if (!name || !phone) {
    res.status(400).json({ error: "name et phone sont requis" });
    return;
  }
  const [client] = await db
    .insert(clientsTable)
    .values({
      name: String(name),
      phone: String(phone),
      email: email ? String(email) : null,
      address: address ? String(address) : null,
      notes: notes ? String(notes) : null,
      isVip: isVip === true || isVip === "true",
    })
    .onConflictDoUpdate({
      target: clientsTable.phone,
      set: {
        name: String(name),
        email: email ? String(email) : null,
        address: address ? String(address) : null,
        notes: notes ? String(notes) : null,
        isVip: isVip === true || isVip === "true",
        updatedAt: new Date(),
      },
    })
    .returning();
  res.status(201).json({ ...fmt(client), totalOrders: 0, totalSpent: 0, lastOrderAt: null });
});

// PATCH /clients/:id
router.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { name, email, address, notes, isVip } = req.body as Record<string, string | boolean>;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email;
  if (address !== undefined) updates.address = address;
  if (notes !== undefined) updates.notes = notes;
  if (isVip !== undefined) updates.isVip = isVip === true || isVip === "true";

  const [updated] = await db.update(clientsTable).set(updates).where(eq(clientsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Client non trouvé" }); return; }
  res.json({ ...fmt(updated), totalOrders: 0, totalSpent: 0, lastOrderAt: null });
});

// DELETE /clients/:id
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(clientsTable).where(eq(clientsTable.id, id));
  res.json({ ok: true });
});

export default router;
