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
  users,
  practices,
  rooms,
  staff,
  simulations
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

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
}

export const storage = new DatabaseStorage();
