import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const scrapeRuns = pgTable("scrape_runs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  status: text("status").notNull().default("pending"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  jobsFound: integer("jobs_found").default(0).notNull(),
  sources: text("sources").array().notNull(),
  error: text("error"),
  includeProductAnalyst: boolean("include_product_analyst").default(false).notNull(),
  maxJobs: integer("max_jobs").default(40).notNull(),
  locations: text("locations").array().notNull().default(sql`'{"India", "Remote"}'`),
  timePeriod: integer("time_period").notNull().default(7),
  targetRoles: text("target_roles").array().notNull().default(sql`'{"APM", "Junior PM", "Assistant PM", "Entry-Level PM"}'`),
});

export const jobs = pgTable("jobs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  company: text("company").notNull(),
  location: text("location").notNull(),
  source: text("source").notNull(),
  url: text("url").notNull(),
  postedDate: text("posted_date"),
  relevanceReason: text("relevance_reason").notNull(),
  scrapedAt: timestamp("scraped_at").defaultNow().notNull(),
  runId: integer("run_id").references(() => scrapeRuns.id),
  salary: text("salary"),
  description: text("description"),
  isNew: boolean("is_new").default(true).notNull(),
  status: text("status").default("discovered").notNull(),
});

export const scrapeRunsRelations = relations(scrapeRuns, ({ many }) => ({
  jobs: many(jobs),
}));

export const jobsRelations = relations(jobs, ({ one }) => ({
  run: one(scrapeRuns, {
    fields: [jobs.runId],
    references: [scrapeRuns.id],
  }),
}));

export const insertScrapeRunSchema = z.object({
  sources: z.array(z.string()),
  includeProductAnalyst: z.boolean().default(false),
  maxJobs: z.number().default(40).optional(),
  locations: z.array(z.string()).optional(),
  timePeriod: z.number().optional(),
  targetRoles: z.array(z.string()).optional(),
});

export const insertJobSchema = z.object({
  title: z.string(),
  company: z.string(),
  location: z.string(),
  source: z.string(),
  url: z.string(),
  postedDate: z.string().optional().nullable(),
  relevanceReason: z.string(),
  runId: z.number().optional().nullable(),
  salary: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  status: z.string().optional().default("discovered"),
});

export type ScrapeRun = typeof scrapeRuns.$inferSelect;
export type InsertScrapeRun = z.infer<typeof insertScrapeRunSchema>;
export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
