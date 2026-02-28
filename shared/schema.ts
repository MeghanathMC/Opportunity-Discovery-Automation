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

export const insertScrapeRunSchema = createInsertSchema(scrapeRuns).omit({
  id: true,
  startedAt: true,
  completedAt: true,
  jobsFound: true,
  error: true,
  status: true,
});

export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  scrapedAt: true,
  isNew: true,
});

export type ScrapeRun = typeof scrapeRuns.$inferSelect;
export type InsertScrapeRun = z.infer<typeof insertScrapeRunSchema>;
export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
