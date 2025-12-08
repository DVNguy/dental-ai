import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, jsonb, timestamp, vector } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const practices = pgTable("practices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  budget: integer("budget").notNull().default(50000),
});

export const rooms = pgTable("rooms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  practiceId: varchar("practice_id").notNull().references(() => practices.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  name: text("name").notNull(),
  x: integer("x").notNull(),
  y: integer("y").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
});

export const staff = pgTable("staff", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  practiceId: varchar("practice_id").notNull().references(() => practices.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  role: text("role").notNull(),
  avatar: text("avatar").notNull(),
  efficiency: integer("efficiency").notNull(),
  stress: integer("stress").notNull(),
  traits: text("traits").array().notNull(),
});

export const simulations = pgTable("simulations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  practiceId: varchar("practice_id").notNull().references(() => practices.id, { onDelete: "cascade" }),
  efficiencyScore: real("efficiency_score").notNull(),
  harmonyScore: real("harmony_score").notNull(),
  waitTime: real("wait_time").notNull(),
  patientCapacity: integer("patient_capacity").notNull(),
  parameters: jsonb("parameters").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const knowledgeSources = pgTable("knowledge_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  fileName: text("file_name").notNull(),
  category: text("category").notNull(),
  tags: text("tags").array().notNull(),
  description: text("description"),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

export const knowledgeChunks = pgTable("knowledge_chunks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceId: varchar("source_id").notNull().references(() => knowledgeSources.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  tokens: integer("tokens").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }),
  keyPoints: text("key_points").array(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertPracticeSchema = createInsertSchema(practices).omit({
  id: true,
});

export const insertRoomSchema = createInsertSchema(rooms).omit({
  id: true,
});

export const insertStaffSchema = createInsertSchema(staff).omit({
  id: true,
});

export const insertSimulationSchema = createInsertSchema(simulations).omit({
  id: true,
  timestamp: true,
});

export const insertKnowledgeSourceSchema = createInsertSchema(knowledgeSources).omit({
  id: true,
  uploadedAt: true,
});

export const insertKnowledgeChunkSchema = createInsertSchema(knowledgeChunks).omit({
  id: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertPractice = z.infer<typeof insertPracticeSchema>;
export type Practice = typeof practices.$inferSelect;

export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type Room = typeof rooms.$inferSelect;

export type InsertStaff = z.infer<typeof insertStaffSchema>;
export type Staff = typeof staff.$inferSelect;

export type InsertSimulation = z.infer<typeof insertSimulationSchema>;
export type Simulation = typeof simulations.$inferSelect;

export type InsertKnowledgeSource = z.infer<typeof insertKnowledgeSourceSchema>;
export type KnowledgeSource = typeof knowledgeSources.$inferSelect;

export type InsertKnowledgeChunk = z.infer<typeof insertKnowledgeChunkSchema>;
export type KnowledgeChunk = typeof knowledgeChunks.$inferSelect;
