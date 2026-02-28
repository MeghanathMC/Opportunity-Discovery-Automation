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
      const runIdParam = req.query.runId as string | undefined;
      const runId = runIdParam ? parseInt(runIdParam, 10) : undefined;
      const pageParam = req.query.page as string | undefined;
      const pageSizeParam = req.query.pageSize as string | undefined;
      const page = pageParam ? parseInt(pageParam, 10) || 1 : 1;
      const pageSizeRaw = pageSizeParam ? parseInt(pageSizeParam, 10) || 10 : 10;
      const pageSize = Math.max(1, Math.min(pageSizeRaw, 100));
      const offset = (page - 1) * pageSize;

      const jobs = await storage.getJobs({
        source,
        search,
        runId: Number.isNaN(runId) ? undefined : runId,
        limit: pageSize,
        offset,
      });
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

  app.delete("/api/runs/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    try {
      console.log(`[API] DELETE /api/runs/${id} requested`);
      await storage.deleteScrapeRun(id);
      console.log(`[API] DELETE /api/runs/${id} successful`);
      res.sendStatus(204);
    } catch (error: any) {
      console.error(`[API] DELETE /api/runs/${id} failed:`, error);
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/jobs/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      const updated = await storage.updateJob(id, { status });
      if (!updated) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
