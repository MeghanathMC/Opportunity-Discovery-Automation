import {
  type Job,
  type InsertJob,
  type ScrapeRun,
  type InsertScrapeRun,
  jobs,
  scrapeRuns,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, ilike, or, sql } from "drizzle-orm";

export interface IStorage {
  getJobs(filters?: { source?: string; search?: string }): Promise<Job[]>;
  getJobById(id: number): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  createJobs(jobList: InsertJob[]): Promise<Job[]>;
  markJobsSeen(ids: number[]): Promise<void>;
  getJobCount(): Promise<number>;
  getScrapeRuns(): Promise<ScrapeRun[]>;
  getScrapeRunById(id: number): Promise<ScrapeRun | undefined>;
  createScrapeRun(run: InsertScrapeRun): Promise<ScrapeRun>;
  updateScrapeRun(id: number, data: Partial<ScrapeRun>): Promise<ScrapeRun | undefined>;
  getLatestRun(): Promise<ScrapeRun | undefined>;
  getStats(): Promise<{ totalJobs: number; newJobs: number; totalRuns: number; sources: string[] }>;
  isDuplicateJob(url: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getJobs(filters?: { source?: string; search?: string }): Promise<Job[]> {
    const conditions = [];
    if (filters?.source && filters.source !== "all") {
      conditions.push(eq(jobs.source, filters.source));
    }
    if (filters?.search) {
      conditions.push(
        or(
          ilike(jobs.title, `%${filters.search}%`),
          ilike(jobs.company, `%${filters.search}%`),
          ilike(jobs.location, `%${filters.search}%`)
        )
      );
    }
    if (conditions.length > 0) {
      return db.select().from(jobs).where(and(...conditions)).orderBy(desc(jobs.scrapedAt));
    }
    return db.select().from(jobs).orderBy(desc(jobs.scrapedAt));
  }

  async getJobById(id: number): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    return job || undefined;
  }

  async createJob(job: InsertJob): Promise<Job> {
    const [created] = await db.insert(jobs).values(job).returning();
    return created;
  }

  async createJobs(jobList: InsertJob[]): Promise<Job[]> {
    if (jobList.length === 0) return [];
    const created = await db.insert(jobs).values(jobList).returning();
    return created;
  }

  async markJobsSeen(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    for (const id of ids) {
      await db.update(jobs).set({ isNew: false }).where(eq(jobs.id, id));
    }
  }

  async getJobCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(jobs);
    return Number(result[0].count);
  }

  async getScrapeRuns(): Promise<ScrapeRun[]> {
    return db.select().from(scrapeRuns).orderBy(desc(scrapeRuns.startedAt));
  }

  async getScrapeRunById(id: number): Promise<ScrapeRun | undefined> {
    const [run] = await db.select().from(scrapeRuns).where(eq(scrapeRuns.id, id));
    return run || undefined;
  }

  async createScrapeRun(run: InsertScrapeRun): Promise<ScrapeRun> {
    const [created] = await db.insert(scrapeRuns).values(run).returning();
    return created;
  }

  async updateScrapeRun(id: number, data: Partial<ScrapeRun>): Promise<ScrapeRun | undefined> {
    const [updated] = await db
      .update(scrapeRuns)
      .set(data)
      .where(eq(scrapeRuns.id, id))
      .returning();
    return updated || undefined;
  }

  async getLatestRun(): Promise<ScrapeRun | undefined> {
    const [run] = await db
      .select()
      .from(scrapeRuns)
      .orderBy(desc(scrapeRuns.startedAt))
      .limit(1);
    return run || undefined;
  }

  async getStats(): Promise<{ totalJobs: number; newJobs: number; totalRuns: number; sources: string[] }> {
    const totalResult = await db.select({ count: sql<number>`count(*)` }).from(jobs);
    const newResult = await db.select({ count: sql<number>`count(*)` }).from(jobs).where(eq(jobs.isNew, true));
    const runsResult = await db.select({ count: sql<number>`count(*)` }).from(scrapeRuns);
    const sourcesResult = await db.select({ source: jobs.source }).from(jobs).groupBy(jobs.source);

    return {
      totalJobs: Number(totalResult[0].count),
      newJobs: Number(newResult[0].count),
      totalRuns: Number(runsResult[0].count),
      sources: sourcesResult.map((s) => s.source),
    };
  }

  async isDuplicateJob(url: string): Promise<boolean> {
    const [existing] = await db.select().from(jobs).where(eq(jobs.url, url)).limit(1);
    return !!existing;
  }
}

export const storage = new DatabaseStorage();
