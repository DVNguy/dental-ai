import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, jsonb, timestamp, vector, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const practices = pgTable("practices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  budget: integer("budget").notNull().default(50000),
  layoutScalePxPerMeter: integer("layout_scale_px_per_meter").notNull().default(50),
  ownerId: varchar("owner_id").notNull().references(() => users.id),
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

export const CONTRACT_TYPES = ["fulltime", "parttime", "minijob", "freelance"] as const;
export type ContractType = typeof CONTRACT_TYPES[number];

export const staff = pgTable("staff", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  practiceId: varchar("practice_id").notNull().references(() => practices.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  role: text("role").notNull(),
  avatar: text("avatar").notNull(),
  experienceLevel: integer("experience_level").notNull().default(3),
  specializations: text("specializations").array().notNull().default([]),
  // HR KPI fields
  fte: real("fte").notNull().default(1.0),
  weeklyHours: real("weekly_hours").notNull().default(40),
  hourlyCost: real("hourly_cost").notNull().default(25),
  contractType: text("contract_type").$type<ContractType>().default("fulltime"),
  hireDate: timestamp("hire_date"),
  terminationDate: timestamp("termination_date"),
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

export const WORKFLOW_SOURCES = ["builtin", "custom", "knowledge"] as const;
export type WorkflowSource = typeof WORKFLOW_SOURCES[number];

export const workflows = pgTable("workflows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  practiceId: varchar("practice_id").notNull().references(() => practices.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  actorType: text("actor_type").notNull().$type<WorkflowActorType>(),
  source: text("source").notNull().$type<WorkflowSource>().default("custom"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("workflows_practice_slug_idx").on(table.practiceId, table.slug),
]);

export const CONNECTION_KINDS = ["patient", "staff"] as const;
export type ConnectionKind = typeof CONNECTION_KINDS[number];

export const DISTANCE_CLASSES = ["auto", "short", "medium", "long"] as const;
export type DistanceClass = typeof DISTANCE_CLASSES[number];

export const workflowConnections = pgTable("workflow_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  practiceId: varchar("practice_id").notNull().references(() => practices.id, { onDelete: "cascade" }),
  fromRoomId: varchar("from_room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  toRoomId: varchar("to_room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  kind: text("kind").notNull().$type<ConnectionKind>().default("patient"),
  weight: integer("weight").notNull().default(1),
  distanceClass: text("distance_class").notNull().$type<DistanceClass>().default("auto"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const STEP_LINE_TYPES = ["default", "critical", "optional", "automated"] as const;
export type StepLineType = typeof STEP_LINE_TYPES[number];

export const workflowSteps = pgTable("workflow_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workflowId: varchar("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
  stepIndex: integer("step_index").notNull(),
  fromRoomId: varchar("from_room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  toRoomId: varchar("to_room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  weight: real("weight").notNull().default(1),
  lineType: text("line_type").$type<StepLineType>().default("default"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const ARCHITECTURAL_ELEMENT_TYPES = ["door", "window"] as const;
export type ArchitecturalElementType = typeof ARCHITECTURAL_ELEMENT_TYPES[number];

export const DOOR_HINGE_SIDES = ["left", "right"] as const;
export type DoorHingeSide = typeof DOOR_HINGE_SIDES[number];

export const DOOR_OPENING_DIRECTIONS = ["in", "out"] as const;
export type DoorOpeningDirection = typeof DOOR_OPENING_DIRECTIONS[number];

export const architecturalElements = pgTable("architectural_elements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  practiceId: varchar("practice_id").notNull().references(() => practices.id, { onDelete: "cascade" }),
  type: text("type").notNull().$type<ArchitecturalElementType>(),
  x: integer("x").notNull(),
  y: integer("y").notNull(),
  width: integer("width").notNull(),
  rotation: integer("rotation").notNull().default(0),
  floor: integer("floor").notNull().default(0),
  hinge: text("hinge").$type<DoorHingeSide>().default("left"),
  openingDirection: text("opening_direction").$type<DoorOpeningDirection>().default("in"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// HR Module Tables

export const ABSENCE_TYPES = ["sick", "vacation", "unpaid", "maternity", "training"] as const;
export type AbsenceType = typeof ABSENCE_TYPES[number];

export const staffAbsences = pgTable("staff_absences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  practiceId: varchar("practice_id").notNull().references(() => practices.id, { onDelete: "cascade" }),
  absenceType: text("absence_type").notNull().$type<AbsenceType>(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  days: real("days").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const staffOvertime = pgTable("staff_overtime", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  practiceId: varchar("practice_id").notNull().references(() => practices.id, { onDelete: "cascade" }),
  date: timestamp("date").notNull(),
  hours: real("hours").notNull(),
  reason: text("reason"),
  approved: integer("approved").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const ALERT_SEVERITIES = ["info", "warn", "critical"] as const;
export type AlertSeverity = typeof ALERT_SEVERITIES[number];

export const hrAlerts = pgTable("hr_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  practiceId: varchar("practice_id").notNull().references(() => practices.id, { onDelete: "cascade" }),
  severity: text("severity").notNull().$type<AlertSeverity>(),
  code: text("code").notNull(),
  title: text("title").notNull(),
  explanation: text("explanation").notNull(),
  recommendedActions: text("recommended_actions").array().notNull(),
  metric: text("metric").notNull(),
  metricValue: real("metric_value"),
  threshold: real("threshold"),
  acknowledged: integer("acknowledged").notNull().default(0),
  acknowledgedAt: timestamp("acknowledged_at"),
  acknowledgedBy: varchar("acknowledged_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const hrKpiSnapshots = pgTable("hr_kpi_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  practiceId: varchar("practice_id").notNull().references(() => practices.id, { onDelete: "cascade" }),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  // FTE metrics
  currentFte: real("current_fte").notNull(),
  targetFte: real("target_fte").notNull(),
  fteQuote: real("fte_quote").notNull(),
  // Absence metrics
  absenceRate: real("absence_rate").notNull(),
  sickRate: real("sick_rate").notNull(),
  vacationRate: real("vacation_rate").notNull(),
  totalAbsenceDays: real("total_absence_days").notNull(),
  // Overtime metrics
  overtimeRate: real("overtime_rate").notNull(),
  totalOvertimeHours: real("total_overtime_hours").notNull(),
  // Labor cost metrics
  laborCostRatio: real("labor_cost_ratio").notNull(),
  totalLaborCost: real("total_labor_cost").notNull(),
  monthlyRevenue: real("monthly_revenue").notNull(),
  // Turnover metrics
  turnoverRate: real("turnover_rate"),
  // Raw data for recalculation
  staffCount: integer("staff_count").notNull(),
  alertsGenerated: integer("alerts_generated").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const upsertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
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

export const updateWorkflowConnectionSchema = insertWorkflowConnectionSchema.partial().omit({
  practiceId: true,
  fromRoomId: true,
  toRoomId: true,
});

export const insertWorkflowStepSchema = createInsertSchema(workflowSteps).omit({
  id: true,
  createdAt: true,
});

export const insertArchitecturalElementSchema = createInsertSchema(architecturalElements).omit({
  id: true,
  createdAt: true,
});

// HR Module schemas
export const insertStaffAbsenceSchema = createInsertSchema(staffAbsences).omit({
  id: true,
  createdAt: true,
});

export const insertStaffOvertimeSchema = createInsertSchema(staffOvertime).omit({
  id: true,
  createdAt: true,
});

export const insertHrAlertSchema = createInsertSchema(hrAlerts).omit({
  id: true,
  createdAt: true,
  acknowledgedAt: true,
});

export const insertHrKpiSnapshotSchema = createInsertSchema(hrKpiSnapshots).omit({
  id: true,
  createdAt: true,
});

export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

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

export type InsertWorkflowStep = z.infer<typeof insertWorkflowStepSchema>;
export type WorkflowStep = typeof workflowSteps.$inferSelect;

export type InsertArchitecturalElement = z.infer<typeof insertArchitecturalElementSchema>;
export type ArchitecturalElement = typeof architecturalElements.$inferSelect;

// HR Module types
export type InsertStaffAbsence = z.infer<typeof insertStaffAbsenceSchema>;
export type StaffAbsence = typeof staffAbsences.$inferSelect;

export type InsertStaffOvertime = z.infer<typeof insertStaffOvertimeSchema>;
export type StaffOvertime = typeof staffOvertime.$inferSelect;

export type InsertHrAlert = z.infer<typeof insertHrAlertSchema>;
export type HrAlert = typeof hrAlerts.$inferSelect;

export type InsertHrKpiSnapshot = z.infer<typeof insertHrKpiSnapshotSchema>;
export type HrKpiSnapshot = typeof hrKpiSnapshots.$inferSelect;
