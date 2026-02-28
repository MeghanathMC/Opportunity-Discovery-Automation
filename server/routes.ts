import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { runScrapeJob } from "./scraper";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/jobs", async (req, res) => {
    try {
      const source = req.query.source as string | undefined;
      const search = req.query.search as string | undefined;
      const jobs = await storage.getJobs({ source, search });
      res.json(jobs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/jobs/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const job = await storage.getJobById(id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.json(job);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/jobs/mark-seen", async (req, res) => {
    try {
      const schema = z.object({ ids: z.array(z.number()) });
      const { ids } = schema.parse(req.body);
      await storage.markJobsSeen(ids);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/stats", async (_req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/runs", async (_req, res) => {
    try {
      const runs = await storage.getScrapeRuns();
      res.json(runs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/runs/latest", async (_req, res) => {
    try {
      const run = await storage.getLatestRun();
      res.json(run || null);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/scrape", async (req, res) => {
    try {
      const schema = z.object({
        sources: z.array(z.string()).min(1),
        includeProductAnalyst: z.boolean().default(false),
        maxJobs: z.number().min(1).max(100).default(40),
        locations: z.array(z.string()).min(1).default(["India", "Remote"]),
        targetRoles: z.array(z.string()).min(1).default(["APM", "Junior PM", "Assistant PM", "Entry-Level PM"]),
        timePeriod: z.number().min(1).default(7),
      });
      const { sources, includeProductAnalyst, maxJobs, locations, targetRoles, timePeriod } = schema.parse(req.body);

      res.json({ message: "Scrape job started", status: "running" });

      runScrapeJob(sources, includeProductAnalyst, maxJobs, locations, targetRoles, timePeriod).catch((error) => {
        console.error("Scrape job failed:", error);
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/export", async (req, res) => {
    try {
      const format = req.query.format as string || "json";
      const jobs = await storage.getJobs();

      if (format === "csv") {
        const headers = "Title,Company,Location,Source,URL,Posted Date,Relevance,Salary\n";
        const rows = jobs.map((j) =>
          `"${j.title}","${j.company}","${j.location}","${j.source}","${j.url}","${j.postedDate || ""}","${j.relevanceReason}","${j.salary || ""}"`
        ).join("\n");
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=pm-jobs.csv");
        res.send(headers + rows);
      } else {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", "attachment; filename=pm-jobs.json");
        res.json(jobs);
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
