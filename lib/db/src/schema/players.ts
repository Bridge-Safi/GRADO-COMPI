import { pgTable, serial, text, integer, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const playersTable = pgTable("players", {
  id: serial("id").primaryKey(),
  pseudo: text("pseudo").notNull(),
  phone: text("phone").notNull().unique(),
  email: text("email"),
  address: text("address"),
  profilePhoto: text("profile_photo"),
  diamonds: integer("diamonds").notNull().default(0),
  score: integer("score").notNull().default(0),
  gamesPlayed: integer("games_played").notNull().default(0),
  isOnline: boolean("is_online").notNull().default(false),
  lastSeenAt: timestamp("last_seen_at"),
  menuCost: integer("menu_cost").notNull().default(60000),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPlayerSchema = createInsertSchema(playersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof playersTable.$inferSelect;
