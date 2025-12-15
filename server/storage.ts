import { 
  type User, 
  type InsertUser,
  type Practice,
  type InsertPractice,
  type Room,
  type InsertRoom,
  type Staff,
  type InsertStaff,
  type Simulation,
  type InsertSimulation,
  type KnowledgeSource,
  type InsertKnowledgeSource,
  type KnowledgeChunk,
  type InsertKnowledgeChunk,
  type Workflow,
  type InsertWorkflow,
  type WorkflowConnection,
  type InsertWorkflowConnection,
  type WorkflowStep,
  type InsertWorkflowStep,
  users,
  practices,
  rooms,
  staff,
  simulations,
  knowledgeSources,
  knowledgeChunks,
  knowledgeArtifacts,
  workflows,
  workflowConnections,
  workflowSteps
} from "@shared/schema";

export interface TableStats {
  count: number;
  latestCreatedAt?: string | null;
  latestUpdatedAt?: string | null;
}

export interface DebugStats {
  tables: {
    users: TableStats;
    practices: TableStats;
    rooms: TableStats;
    staff: TableStats;
    simulations: TableStats;
    knowledgeSources: TableStats;
    knowledgeChunks: TableStats;
    knowledgeArtifacts: TableStats;
    workflows: TableStats;
    workflowConnections: TableStats;
    workflowSteps: TableStats;
  };
  ragConfig: {
    embeddingModel: string;
    vectorDimensions: number;
    targetChunkTokens: string;
    overlap: number;
  };
  workflowDuplicates: { slug: string; practiceId: string; count: number }[];
}
import { db } from "./db";
import { eq, sql, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getPractice(id: string): Promise<Practice | undefined>;
  createPractice(practice: InsertPractice): Promise<Practice>;
  updatePracticeBudget(id: string, budget: number): Promise<Practice | undefined>;
  
  getRoomsByPracticeId(practiceId: string): Promise<Room[]>;
  createRoom(room: InsertRoom): Promise<Room>;
  updateRoom(id: string, updates: Partial<Omit<InsertRoom, 'practiceId'>>): Promise<Room | undefined>;
  deleteRoom(id: string): Promise<void>;
  deleteRoomsByPracticeId(practiceId: string): Promise<void>;
  
  getStaffByPracticeId(practiceId: string): Promise<Staff[]>;
  createStaff(staffMember: InsertStaff): Promise<Staff>;
  updateStaff(id: string, updates: Partial<Omit<InsertStaff, 'practiceId'>>): Promise<Staff | undefined>;
  deleteStaff(id: string): Promise<void>;
  
  getSimulationsByPracticeId(practiceId: string): Promise<Simulation[]>;
  createSimulation(simulation: InsertSimulation): Promise<Simulation>;

  getAllKnowledgeSources(): Promise<KnowledgeSource[]>;
  getKnowledgeSource(id: string): Promise<KnowledgeSource | undefined>;
  createKnowledgeSource(source: InsertKnowledgeSource): Promise<KnowledgeSource>;
  deleteKnowledgeSource(id: string): Promise<void>;
  
  getChunksBySourceId(sourceId: string): Promise<KnowledgeChunk[]>;
  createKnowledgeChunk(chunk: InsertKnowledgeChunk): Promise<KnowledgeChunk>;
  searchKnowledgeChunks(queryEmbedding: number[], limit?: number): Promise<(KnowledgeChunk & { source: KnowledgeSource; similarity: number })[]>;

  getWorkflowsByPracticeId(practiceId: string): Promise<Workflow[]>;
  createWorkflow(workflow: InsertWorkflow): Promise<Workflow>;
  upsertWorkflow(workflow: InsertWorkflow): Promise<Workflow>;
  deleteWorkflow(id: string): Promise<void>;
  
  getConnectionsByPracticeId(practiceId: string): Promise<WorkflowConnection[]>;
  createConnection(connection: InsertWorkflowConnection): Promise<WorkflowConnection>;
  updateConnection(id: string, updates: Partial<Omit<InsertWorkflowConnection, 'practiceId' | 'fromRoomId' | 'toRoomId'>>): Promise<WorkflowConnection | undefined>;
  deleteConnection(id: string): Promise<void>;

  getWorkflowSteps(workflowId: string): Promise<WorkflowStep[]>;
  createWorkflowStep(step: InsertWorkflowStep): Promise<WorkflowStep>;
  deleteWorkflowStep(id: string): Promise<void>;
  getMaxStepIndex(workflowId: string): Promise<number>;
  
  getDebugStats(): Promise<DebugStats>;

  getPracticesByOwnerId(ownerId: string): Promise<Practice[]>;
  getRoomWithPractice(roomId: string): Promise<{room: Room, practice: Practice} | undefined>;
  getStaffWithPractice(staffId: string): Promise<{staff: Staff, practice: Practice} | undefined>;
  getWorkflowWithPractice(workflowId: string): Promise<{workflow: Workflow, practice: Practice} | undefined>;
  getConnectionWithPractice(connectionId: string): Promise<{connection: WorkflowConnection, practice: Practice} | undefined>;
  getStepWithPractice(stepId: string): Promise<{step: WorkflowStep, practice: Practice} | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async getPractice(id: string): Promise<Practice | undefined> {
    const result = await db.select().from(practices).where(eq(practices.id, id));
    return result[0];
  }

  async createPractice(practice: InsertPractice): Promise<Practice> {
    const result = await db.insert(practices).values(practice).returning();
    return result[0];
  }

  async updatePracticeBudget(id: string, budget: number): Promise<Practice | undefined> {
    const result = await db
      .update(practices)
      .set({ budget })
      .where(eq(practices.id, id))
      .returning();
    return result[0];
  }

  async getRoomsByPracticeId(practiceId: string): Promise<Room[]> {
    return await db.select().from(rooms).where(eq(rooms.practiceId, practiceId));
  }

  async createRoom(room: InsertRoom): Promise<Room> {
    const result = await db.insert(rooms).values(room).returning();
    return result[0];
  }

  async updateRoom(id: string, updates: Partial<Omit<InsertRoom, 'practiceId'>>): Promise<Room | undefined> {
    const result = await db
      .update(rooms)
      .set(updates)
      .where(eq(rooms.id, id))
      .returning();
    return result[0];
  }

  async deleteRoom(id: string): Promise<void> {
    await db.delete(rooms).where(eq(rooms.id, id));
  }

  async deleteRoomsByPracticeId(practiceId: string): Promise<void> {
    await db.delete(rooms).where(eq(rooms.practiceId, practiceId));
  }

  async getStaffByPracticeId(practiceId: string): Promise<Staff[]> {
    return await db.select().from(staff).where(eq(staff.practiceId, practiceId));
  }

  async createStaff(staffMember: InsertStaff): Promise<Staff> {
    const result = await db.insert(staff).values(staffMember).returning();
    return result[0];
  }

  async updateStaff(id: string, updates: Partial<Omit<InsertStaff, 'practiceId'>>): Promise<Staff | undefined> {
    const result = await db
      .update(staff)
      .set(updates)
      .where(eq(staff.id, id))
      .returning();
    return result[0];
  }

  async deleteStaff(id: string): Promise<void> {
    await db.delete(staff).where(eq(staff.id, id));
  }

  async getSimulationsByPracticeId(practiceId: string): Promise<Simulation[]> {
    return await db.select().from(simulations).where(eq(simulations.practiceId, practiceId));
  }

  async createSimulation(simulation: InsertSimulation): Promise<Simulation> {
    const result = await db.insert(simulations).values(simulation).returning();
    return result[0];
  }

  async getAllKnowledgeSources(): Promise<KnowledgeSource[]> {
    return await db.select().from(knowledgeSources).orderBy(desc(knowledgeSources.uploadedAt));
  }

  async getKnowledgeSource(id: string): Promise<KnowledgeSource | undefined> {
    const result = await db.select().from(knowledgeSources).where(eq(knowledgeSources.id, id));
    return result[0];
  }

  async createKnowledgeSource(source: InsertKnowledgeSource): Promise<KnowledgeSource> {
    const result = await db.insert(knowledgeSources).values(source).returning();
    return result[0];
  }

  async deleteKnowledgeSource(id: string): Promise<void> {
    await db.delete(knowledgeSources).where(eq(knowledgeSources.id, id));
  }

  async getChunksBySourceId(sourceId: string): Promise<KnowledgeChunk[]> {
    return await db.select().from(knowledgeChunks).where(eq(knowledgeChunks.sourceId, sourceId));
  }

  async createKnowledgeChunk(chunk: InsertKnowledgeChunk): Promise<KnowledgeChunk> {
    const result = await db.insert(knowledgeChunks).values(chunk).returning();
    return result[0];
  }

  async searchKnowledgeChunks(queryEmbedding: number[], limit: number = 10): Promise<(KnowledgeChunk & { source: KnowledgeSource; similarity: number })[]> {
    const embeddingStr = `[${queryEmbedding.join(',')}]`;
    
    const results = await db.execute(sql`
      SELECT 
        kc.id,
        kc.source_id as "sourceId",
        kc.chunk_index as "chunkIndex",
        kc.content,
        kc.tokens,
        kc.key_points as "keyPoints",
        ks.id as "source_id",
        ks.title as "source_title",
        ks.file_name as "source_fileName",
        ks.category as "source_category",
        ks.tags as "source_tags",
        ks.description as "source_description",
        ks.uploaded_at as "source_uploadedAt",
        1 - (kc.embedding <=> ${embeddingStr}::vector) as similarity
      FROM knowledge_chunks kc
      JOIN knowledge_sources ks ON kc.source_id = ks.id
      WHERE kc.embedding IS NOT NULL
      ORDER BY kc.embedding <=> ${embeddingStr}::vector
      LIMIT ${limit}
    `);

    return (results.rows as any[]).map(row => ({
      id: row.id,
      sourceId: row.sourceId,
      headingPath: row.headingPath || null,
      chunkIndex: row.chunkIndex,
      content: row.content,
      contentHash: row.contentHash || null,
      tokens: row.tokens,
      embedding: null,
      keyPoints: row.keyPoints,
      createdAt: row.createdAt || new Date(),
      source: {
        id: row.source_id,
        title: row.source_title,
        fileName: row.source_fileName,
        fileHash: row.source_fileHash || null,
        category: row.source_category,
        tags: row.source_tags,
        description: row.source_description,
        uploadedAt: row.source_uploadedAt,
        updatedAt: row.source_updatedAt || row.source_uploadedAt
      },
      similarity: parseFloat(row.similarity)
    }));
  }

  async getWorkflowsByPracticeId(practiceId: string): Promise<Workflow[]> {
    return await db.select().from(workflows).where(eq(workflows.practiceId, practiceId));
  }

  async createWorkflow(workflow: InsertWorkflow): Promise<Workflow> {
    const result = await db.insert(workflows).values(workflow as any).returning();
    return result[0];
  }

  async upsertWorkflow(workflow: InsertWorkflow): Promise<Workflow> {
    const result = await db.execute(sql`
      INSERT INTO workflows (practice_id, slug, name, actor_type, source)
      VALUES (${workflow.practiceId}, ${workflow.slug}, ${workflow.name}, ${workflow.actorType}, ${workflow.source || 'custom'})
      ON CONFLICT (practice_id, slug) DO UPDATE SET 
        name = EXCLUDED.name,
        actor_type = EXCLUDED.actor_type,
        source = EXCLUDED.source
      RETURNING *
    `);
    
    const row = result.rows[0] as any;
    return {
      id: row.id,
      practiceId: row.practice_id,
      slug: row.slug,
      name: row.name,
      actorType: row.actor_type,
      source: row.source,
      createdAt: row.created_at,
    };
  }

  async deleteWorkflow(id: string): Promise<void> {
    await db.delete(workflows).where(eq(workflows.id, id));
  }

  async getConnectionsByPracticeId(practiceId: string): Promise<WorkflowConnection[]> {
    return await db.select().from(workflowConnections).where(eq(workflowConnections.practiceId, practiceId));
  }

  async createConnection(connection: InsertWorkflowConnection): Promise<WorkflowConnection> {
    const result = await db.insert(workflowConnections).values(connection as any).returning();
    return result[0];
  }

  async updateConnection(id: string, updates: Partial<Omit<InsertWorkflowConnection, 'practiceId' | 'fromRoomId' | 'toRoomId'>>): Promise<WorkflowConnection | undefined> {
    const result = await db
      .update(workflowConnections)
      .set(updates as any)
      .where(eq(workflowConnections.id, id))
      .returning();
    return result[0];
  }

  async deleteConnection(id: string): Promise<void> {
    await db.delete(workflowConnections).where(eq(workflowConnections.id, id));
  }

  async getWorkflowSteps(workflowId: string): Promise<WorkflowStep[]> {
    return await db
      .select()
      .from(workflowSteps)
      .where(eq(workflowSteps.workflowId, workflowId))
      .orderBy(workflowSteps.stepIndex);
  }

  async createWorkflowStep(step: InsertWorkflowStep): Promise<WorkflowStep> {
    const result = await db.insert(workflowSteps).values(step).returning();
    return result[0];
  }

  async deleteWorkflowStep(id: string): Promise<void> {
    await db.delete(workflowSteps).where(eq(workflowSteps.id, id));
  }

  async getMaxStepIndex(workflowId: string): Promise<number> {
    const result = await db.execute(sql`
      SELECT COALESCE(MAX(step_index), -1) as max_index 
      FROM workflow_steps 
      WHERE workflow_id = ${workflowId}
    `);
    return Number((result.rows[0] as any)?.max_index ?? -1);
  }

  async getDebugStats(): Promise<DebugStats> {
    const parseTableStats = (row: any): TableStats => ({
      count: Number(row?.c ?? 0),
      latestCreatedAt: row?.latest_created ?? null,
      latestUpdatedAt: row?.latest_updated ?? null,
    });

    const [
      usersStats,
      practicesStats,
      roomsStats,
      staffStats,
      simsStats,
      ksStats,
      kcStats,
      kaStats,
      wfStats,
      wcStats,
      wsStats,
      duplicates
    ] = await Promise.all([
      db.execute(sql`SELECT COUNT(*) as c FROM users`),
      db.execute(sql`SELECT COUNT(*) as c FROM practices`),
      db.execute(sql`SELECT COUNT(*) as c FROM rooms`),
      db.execute(sql`SELECT COUNT(*) as c FROM staff`),
      db.execute(sql`SELECT COUNT(*) as c, MAX(timestamp) as latest_created FROM simulations`),
      db.execute(sql`SELECT COUNT(*) as c, MAX(uploaded_at) as latest_created, MAX(updated_at) as latest_updated FROM knowledge_sources`),
      db.execute(sql`SELECT COUNT(*) as c, MAX(created_at) as latest_created FROM knowledge_chunks`),
      db.execute(sql`SELECT COUNT(*) as c, MAX(created_at) as latest_created FROM knowledge_artifacts`),
      db.execute(sql`SELECT COUNT(*) as c, MAX(created_at) as latest_created FROM workflows`),
      db.execute(sql`SELECT COUNT(*) as c, MAX(created_at) as latest_created FROM workflow_connections`),
      db.execute(sql`SELECT COUNT(*) as c, MAX(created_at) as latest_created FROM workflow_steps`),
      db.execute(sql`
        SELECT slug, practice_id as "practiceId", COUNT(*) as count
        FROM workflows
        GROUP BY slug, practice_id
        HAVING COUNT(*) > 1
      `),
    ]);

    return {
      tables: {
        users: parseTableStats(usersStats.rows[0]),
        practices: parseTableStats(practicesStats.rows[0]),
        rooms: parseTableStats(roomsStats.rows[0]),
        staff: parseTableStats(staffStats.rows[0]),
        simulations: parseTableStats(simsStats.rows[0]),
        knowledgeSources: parseTableStats(ksStats.rows[0]),
        knowledgeChunks: parseTableStats(kcStats.rows[0]),
        knowledgeArtifacts: parseTableStats(kaStats.rows[0]),
        workflows: parseTableStats(wfStats.rows[0]),
        workflowConnections: parseTableStats(wcStats.rows[0]),
        workflowSteps: parseTableStats(wsStats.rows[0]),
      },
      ragConfig: {
        embeddingModel: "text-embedding-3-small",
        vectorDimensions: 1536,
        targetChunkTokens: "600-900 (optimal: 750)",
        overlap: 100,
      },
      workflowDuplicates: (duplicates.rows as any[]).map(row => ({
        slug: row.slug,
        practiceId: row.practiceId,
        count: Number(row.count),
      })),
    };
  }

  async getPracticesByOwnerId(ownerId: string): Promise<Practice[]> {
    return await db.select().from(practices).where(eq(practices.ownerId, ownerId));
  }

  async getRoomWithPractice(roomId: string): Promise<{room: Room, practice: Practice} | undefined> {
    const result = await db.select().from(rooms).where(eq(rooms.id, roomId));
    if (!result[0]) return undefined;
    const practice = await this.getPractice(result[0].practiceId);
    if (!practice) return undefined;
    return { room: result[0], practice };
  }

  async getStaffWithPractice(staffId: string): Promise<{staff: Staff, practice: Practice} | undefined> {
    const result = await db.select().from(staff).where(eq(staff.id, staffId));
    if (!result[0]) return undefined;
    const practice = await this.getPractice(result[0].practiceId);
    if (!practice) return undefined;
    return { staff: result[0], practice };
  }

  async getWorkflowWithPractice(workflowId: string): Promise<{workflow: Workflow, practice: Practice} | undefined> {
    const result = await db.select().from(workflows).where(eq(workflows.id, workflowId));
    if (!result[0]) return undefined;
    const practice = await this.getPractice(result[0].practiceId);
    if (!practice) return undefined;
    return { workflow: result[0], practice };
  }

  async getConnectionWithPractice(connectionId: string): Promise<{connection: WorkflowConnection, practice: Practice} | undefined> {
    const result = await db.select().from(workflowConnections).where(eq(workflowConnections.id, connectionId));
    if (!result[0]) return undefined;
    const practice = await this.getPractice(result[0].practiceId);
    if (!practice) return undefined;
    return { connection: result[0], practice };
  }

  async getStepWithPractice(stepId: string): Promise<{step: WorkflowStep, practice: Practice} | undefined> {
    const result = await db.select().from(workflowSteps).where(eq(workflowSteps.id, stepId));
    if (!result[0]) return undefined;
    const workflow = await db.select().from(workflows).where(eq(workflows.id, result[0].workflowId));
    if (!workflow[0]) return undefined;
    const practice = await this.getPractice(workflow[0].practiceId);
    if (!practice) return undefined;
    return { step: result[0], practice };
  }
}

export const storage = new DatabaseStorage();
