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
  layoutScalePxPerMeter: integer("layout_scale_px_per_meter").notNull().default(50),
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
  floor: integer("floor").notNull().default(0),
});

export const staff = pgTable("staff", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  practiceId: varchar("practice_id").notNull().references(() => practices.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  role: text("role").notNull(),
  avatar: text("avatar").notNull(),
  experienceLevel: integer("experience_level").notNull().default(3),
  specializations: text("specializations").array().notNull().default([]),
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
  fileHash: text("file_hash"),
  category: text("category").notNull(),
  tags: text("tags").array().notNull(),
  description: text("description"),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const knowledgeChunks = pgTable("knowledge_chunks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceId: varchar("source_id").notNull().references(() => knowledgeSources.id, { onDelete: "cascade" }),
  headingPath: text("heading_path"),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  contentHash: text("content_hash"),
  tokens: integer("tokens").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }),
  keyPoints: text("key_points").array(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const knowledgeArtifacts = pgTable("knowledge_artifacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  artifactType: text("artifact_type").notNull(),
  module: text("module").notNull(),
  topic: text("topic").notNull(),
  payloadJson: jsonb("payload_json").notNull(),
  sourceCitations: jsonb("source_citations").notNull(),
  confidence: real("confidence").notNull().default(0.8),
  version: integer("version").notNull().default(1),
  sourceHash: text("source_hash"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const WORKFLOW_ACTOR_TYPES = ["patient", "staff", "instruments"] as const;
export type WorkflowActorType = typeof WORKFLOW_ACTOR_TYPES[number];

export const workflows = pgTable("workflows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  practiceId: varchar("practice_id").notNull().references(() => practices.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  actorType: text("actor_type").notNull().$type<WorkflowActorType>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const workflowConnections = pgTable("workflow_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workflowId: varchar("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
  fromRoomId: varchar("from_room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  toRoomId: varchar("to_room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  label: text("label"),
  weight: integer("weight").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
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

export const insertKnowledgeArtifactSchema = createInsertSchema(knowledgeArtifacts).omit({
  id: true,
  createdAt: true,
});

export const insertWorkflowSchema = createInsertSchema(workflows).omit({
  id: true,
  createdAt: true,
});

export const insertWorkflowConnectionSchema = createInsertSchema(workflowConnections).omit({
  id: true,
  createdAt: true,
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

export type InsertKnowledgeArtifact = z.infer<typeof insertKnowledgeArtifactSchema>;
export type KnowledgeArtifact = typeof knowledgeArtifacts.$inferSelect;

export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;
export type Workflow = typeof workflows.$inferSelect;

export type InsertWorkflowConnection = z.infer<typeof insertWorkflowConnectionSchema>;
export type WorkflowConnection = typeof workflowConnections.$inferSelect;
