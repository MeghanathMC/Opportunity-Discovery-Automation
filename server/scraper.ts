import { type InsertJob } from "@shared/schema";
import { storage } from "./storage";
import { log } from "./index";

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const APIFY_BASE_URL = "https://api.apify.com/v2";

const LINKEDIN_JOBS_ACTOR = "hKByXkMQaC5Qt9UMN";
const INDEED_ACTOR = "hMvNSpz3JnHgl5jkh";
const WELLFOUND_ACTOR = "0n8u4hOC5wGqjnpLa";
const NAUKRI_ACTOR = "EYXvM0o2lS7rYzgey";

const INDIA_CITIES = [
  "bangalore", "bengaluru", "mumbai", "delhi", "hyderabad", "pune", 
  "chennai", "kolkata", "gurgaon", "gurugram", "noida", "ahmedabad", 
  "jaipur", "kochi", "chandigarh", "thiruvananthapuram"
];

function isRelevantTitle(title: string, targetRoles: string[], includeProductAnalyst: boolean): boolean {
  const lower = title.toLowerCase();
  const lowerRoles = targetRoles.map(r => r.toLowerCase());
  if (includeProductAnalyst) {
    lowerRoles.push("product analyst", "product associate");
  }
  return lowerRoles.some((t) => lower.includes(t));
}

function isRelevantLocation(location: string, targetLocations: string[]): boolean {
  const lower = location.toLowerCase();
  const lowerTargets = targetLocations.map(l => l.toLowerCase());
  
  const includesIndia = lowerTargets.some(l => l.includes("india"));
  if (includesIndia && INDIA_CITIES.some(c => lower.includes(c))) return true;
  if (lowerTargets.some((loc) => lower.includes(loc))) return true;
  
  const includesRemote = lowerTargets.some(l => l.includes("remote") || l.includes("global"));
  if (includesRemote && (lower.includes("remote") || lower.includes("anywhere") || lower.includes("work from home") || lower.includes("wfh"))) return true;
  
  return false;
}

function getRelevanceReason(title: string, location: string, source: string, targetRoles: string[], targetLocations: string[]): string {
  const reasons: string[] = [];
  const lowerTitle = title.toLowerCase();
  const lowerLoc = location.toLowerCase();

  const matchedRole = targetRoles.find(role => lowerTitle.includes(role.toLowerCase()));
  if (matchedRole) {
    reasons.push(`${matchedRole} role`);
  } else if (lowerTitle.includes("product analyst") || lowerTitle.includes("product associate")) {
    reasons.push("Product Analyst / Associate role");
  } else {
    reasons.push("Matches target roles");
  }

  const matchedLoc = targetLocations.find(loc => lowerLoc.includes(loc.toLowerCase()));
  if (matchedLoc) {
    reasons.push(`${matchedLoc} location`);
  } else if (lowerLoc.includes("remote") || lowerLoc.includes("anywhere") || lowerLoc.includes("work from home")) {
    reasons.push("Remote/global position");
  } else if (targetLocations.some(l => l.toLowerCase().includes("india")) && INDIA_CITIES.some(c => lowerLoc.includes(c))) {
    reasons.push("India-based location");
  }

  reasons.push(`Found on ${source}`);
  return reasons.join(" | ");
}

async function runApifyActor(actorId: string, input: Record<string, any>): Promise<any[]> {
  if (!APIFY_TOKEN) {
    throw new Error("APIFY_TOKEN is not set");
  }

  try {
    log(`Starting Apify actor ${actorId}...`, "scraper");

    const runResponse = await fetch(
      `${APIFY_BASE_URL}/acts/${actorId}/runs?token=${APIFY_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }
    );

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      throw new Error(`Failed to start actor ${actorId}: ${runResponse.status} ${errorText}`);
    }

    const runData = await runResponse.json();
    const runId = runData.data.id;
    log(`Actor run started with ID: ${runId}`, "scraper");

    let status = "RUNNING";
    let attempts = 0;
    const maxAttempts = 120;

    while (status === "RUNNING" || status === "READY") {
      if (attempts >= maxAttempts) {
        throw new Error(`Actor run timed out after ${maxAttempts * 5} seconds`);
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
      attempts++;

      const statusResponse = await fetch(
        `${APIFY_BASE_URL}/actor-runs/${runId}?token=${APIFY_TOKEN}`
      );
      if (!statusResponse.ok) continue;
      const statusData = await statusResponse.json();
      status = statusData.data.status;
      if (attempts % 6 === 0) {
        log(`Actor run status: ${status} (${attempts * 5}s elapsed)`, "scraper");
      }
    }

    if (status !== "SUCCEEDED") {
      throw new Error(`Actor run finished with status: ${status}`);
    }

    const datasetResponse = await fetch(
      `${APIFY_BASE_URL}/actor-runs/${runId}/dataset/items?token=${APIFY_TOKEN}`
    );

    if (!datasetResponse.ok) {
      throw new Error(`Failed to fetch dataset: ${datasetResponse.status}`);
    }

    const items = await datasetResponse.json();
    log(`Got ${items.length} items from actor ${actorId}`, "scraper");
    return items;
  } catch (error: any) {
    log(`Error running actor ${actorId}: ${error.message}`, "scraper");
    throw error;
  }
}

async function scrapeIndeed(includeProductAnalyst: boolean, targetRoles: string[], locations: string[], timePeriod: number): Promise<InsertJob[]> {
  const searchQueries = [...targetRoles];
  if (includeProductAnalyst) {
    searchQueries.push("product analyst", "product associate");
  }

  const allJobs: InsertJob[] = [];
  const primaryLoc = locations.length > 0 ? locations[0] : "India";

  for (const query of searchQueries) {
    try {
      const items = await runApifyActor(INDEED_ACTOR, {
        position: query,
        country: "IN",
        location: primaryLoc,
        maxItemsPerSearch: 15,
        parseCompanyDetails: false,
        saveOnlyUniqueItems: true,
        followApplyRedirects: false,
      });

      for (const item of items) {
        const title = item.positionName || item.title || "";
        const company = item.company || item.companyName || "Unknown";
        const location = item.location || item.jobLocation || primaryLoc;
        const url = item.url || item.externalApplyLink || "";
        const postedDate = item.postedAt || item.scrapedAt || "";
        const salary = item.salary || "";
        const description = (item.description || "").substring(0, 500);

        if (!title || !url) continue;
        if (!isRelevantTitle(title, targetRoles, includeProductAnalyst)) continue;
        if (!isRelevantLocation(location, locations)) continue;

        const isDuplicate = await storage.isDuplicateJob(url);
        if (isDuplicate) continue;

        allJobs.push({
          title,
          company,
          location,
          source: "Indeed",
          url,
          postedDate: postedDate || null,
          relevanceReason: getRelevanceReason(title, location, "Indeed", targetRoles, locations),
          runId: null,
          salary: salary || null,
          description: description || null,
        });
      }
    } catch (error: any) {
      log(`Error scraping Indeed for "${query}": ${error.message}`, "scraper");
    }
  }

  return allJobs;
}

async function scrapeLinkedIn(includeProductAnalyst: boolean, targetRoles: string[], locations: string[], timePeriod: number): Promise<InsertJob[]> {
  const timeParam = timePeriod * 86400;
  const searchQueries = [...targetRoles];
  if (includeProductAnalyst) searchQueries.push("product analyst", "product associate");

  const searchUrls: string[] = [];
  for (const query of searchQueries) {
      for (const loc of locations) {
        searchUrls.push(`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(query)}&location=${encodeURIComponent(loc)}&f_TPR=r${timeParam}`);
      }
  }

  const allJobs: InsertJob[] = [];

  try {
    const items = await runApifyActor(LINKEDIN_JOBS_ACTOR, {
      urls: searchUrls,
      scrapeCompany: false,
      count: 100,
    });

    for (const item of items) {
      const title = item.title || item.jobTitle || item.positionName || "";
      const company = item.companyName || item.company || item.companyTitle || "Unknown";
      const location = item.location || item.place || item.jobLocation || "India";
      const url = item.jobUrl || item.url || item.link || item.applyUrl || "";
      const postedDate = item.postedAt || item.publishedAt || item.postedTime || item.listedAt || "";
      const salary = item.salary || item.salaryInfo || "";
      const description = (item.description || item.descriptionText || "").substring(0, 500);

      if (!title || !url) continue;
      if (!isRelevantTitle(title, targetRoles, includeProductAnalyst)) continue;

      const isDuplicate = await storage.isDuplicateJob(url);
      if (isDuplicate) continue;

      allJobs.push({
        title,
        company,
        location,
        source: "LinkedIn",
        url,
        postedDate: postedDate ? String(postedDate) : null,
        relevanceReason: getRelevanceReason(title, location, "LinkedIn", targetRoles, locations),
        runId: null,
        salary: salary || null,
        description: description || null,
      });
    }
  } catch (error: any) {
    log(`Error scraping LinkedIn: ${error.message}`, "scraper");
  }

  return allJobs;
}

async function scrapeWellfound(includeProductAnalyst: boolean, targetRoles: string[], locations: string[], timePeriod: number): Promise<InsertJob[]> {
  const allJobs: InsertJob[] = [];
  const primaryLoc = locations.find(l => !l.toLowerCase().includes("remote")) || "worldwide";
  const isRemote = locations.some(l => l.toLowerCase().includes("remote") || l.toLowerCase().includes("global"));

  try {
    const items = await runApifyActor(WELLFOUND_ACTOR, {
      job_title: "product-manager",
      location: primaryLoc,
      remote: isRemote,
      max_items: 30,
    });

    for (const item of items) {
      const title = item.title || item.jobTitle || item.role || "";
      const company = item.companyName || item.company || item.startup || "Unknown";
      const location = item.location || item.jobLocation || "India / Remote";
      const url = item.url || item.jobUrl || item.applyUrl || "";
      const postedDate = item.postedAt || item.publishedAt || item.createdAt || "";
      const salary = item.compensation || item.salary || item.salaryRange || "";
      const description = (item.description || item.jobDescription || "").substring(0, 500);

      if (!title || !url) continue;
      if (!isRelevantTitle(title, targetRoles, includeProductAnalyst)) continue;
      if (!isRelevantLocation(location, locations)) continue;

      const isDuplicate = await storage.isDuplicateJob(url);
      if (isDuplicate) continue;

      allJobs.push({
        title,
        company,
        location,
        source: "Wellfound",
        url,
        postedDate: postedDate ? String(postedDate) : null,
        relevanceReason: getRelevanceReason(title, location, "Wellfound", targetRoles, locations),
        runId: null,
        salary: salary ? String(salary) : null,
        description: description || null,
      });
    }
  } catch (error: any) {
    log(`Error scraping Wellfound: ${error.message}`, "scraper");
  }

  return allJobs;
}

async function scrapeNaukri(includeProductAnalyst: boolean, targetRoles: string[], locations: string[], timePeriod: number): Promise<InsertJob[]> {
  const searchUrls: string[] = [];
  const searchQueries = [...targetRoles];
  if (includeProductAnalyst) searchQueries.push("product analyst", "product associate");
  
  for (const query of searchQueries) {
     for (const loc of locations) {
        if (loc.toLowerCase().includes("remote") || loc.toLowerCase().includes("global")) continue;
        const formattedQuery = query.toLowerCase().replace(/ /g, "-");
        const formattedLoc = loc.toLowerCase().replace(/ /g, "-");
        if (loc.toLowerCase() === "india") {
           searchUrls.push(`https://www.naukri.com/${formattedQuery}-jobs?jobAge=${timePeriod}`);
        } else {
           searchUrls.push(`https://www.naukri.com/${formattedQuery}-jobs-in-${formattedLoc}?jobAge=${timePeriod}`);
        }
     }
  }

  if (searchUrls.length === 0 && includeProductAnalyst) {
    searchUrls.push(`https://www.naukri.com/product-analyst-jobs?jobAge=${timePeriod}`);
  }

  const allJobs: InsertJob[] = [];

  try {
    const items = await runApifyActor(NAUKRI_ACTOR, {
      startUrls: searchUrls.map((url) => ({ url })),
      maxItems: 30,
      maxConcurrency: 5,
    });

    for (const item of items) {
      const title = item.title || item.jobTitle || item.designation || "";
      const company = item.companyName || item.company || "Unknown";
      const location = item.location || item.placeholders?.find((p: any) => p.type === "location")?.label || item.jobLocation || "India";
      const url = item.url || item.jdURL || item.applyUrl || "";
      const postedDate = item.postedDate || item.footerPlaceholderLabel || item.createdDate || "";
      const salary = item.salary || item.salaryLabel || item.placeholders?.find((p: any) => p.type === "salary")?.label || "";
      const description = (item.description || item.jobDescription || item.snippet || "").substring(0, 500);
      const experience = item.experience || item.placeholders?.find((p: any) => p.type === "experience")?.label || "";

      if (!title || !url) continue;
      if (!isRelevantTitle(title, targetRoles, includeProductAnalyst)) continue;

      const isDuplicate = await storage.isDuplicateJob(url);
      if (isDuplicate) continue;

      allJobs.push({
        title,
        company,
        location: typeof location === "string" ? location : "India",
        source: "Naukri",
        url,
        postedDate: postedDate ? String(postedDate) : null,
        relevanceReason: getRelevanceReason(title, typeof location === "string" ? location : "India", "Naukri", targetRoles, locations) + (experience ? ` | ${experience}` : ""),
        runId: null,
        salary: salary ? String(salary) : null,
        description: description || null,
      });
    }
  } catch (error: any) {
    log(`Error scraping Naukri: ${error.message}`, "scraper");
  }

  return allJobs;
}

export async function runScrapeJob(
  sources: string[],
  includeProductAnalyst: boolean,
  maxJobs: number = 40,
  locations: string[] = ["India", "Remote"],
  targetRoles: string[] = ["APM", "Junior PM", "Assistant PM", "Entry-Level PM"],
  timePeriod: number = 7
): Promise<{ runId: number; jobs: InsertJob[] }> {
  const run = await storage.createScrapeRun({
    sources,
    includeProductAnalyst,
    maxJobs,
    locations,
    targetRoles,
    timePeriod
  });

  await storage.updateScrapeRun(run.id, { status: "running" });

  let allJobs: InsertJob[] = [];
  const errors: string[] = [];

  try {
    const scrapers: Promise<InsertJob[]>[] = [];

    if (sources.includes("indeed")) {
      scrapers.push(scrapeIndeed(includeProductAnalyst, targetRoles, locations, timePeriod));
    }
    if (sources.includes("linkedin")) {
      scrapers.push(scrapeLinkedIn(includeProductAnalyst, targetRoles, locations, timePeriod));
    }
    if (sources.includes("wellfound")) {
      scrapers.push(scrapeWellfound(includeProductAnalyst, targetRoles, locations, timePeriod));
    }
    if (sources.includes("naukri")) {
      scrapers.push(scrapeNaukri(includeProductAnalyst, targetRoles, locations, timePeriod));
    }

    const results = await Promise.allSettled(scrapers);

    for (const result of results) {
      if (result.status === "fulfilled") {
        allJobs.push(...result.value);
      } else {
        errors.push(result.reason?.message || "Unknown scraper error");
      }
    }

    allJobs = allJobs.slice(0, maxJobs);

    const jobsWithRunId = allJobs.map((job) => ({
      ...job,
      runId: run.id,
    }));

    let savedJobs: any[] = [];
    if (jobsWithRunId.length > 0) {
      savedJobs = await storage.createJobs(jobsWithRunId);
    }

    await storage.updateScrapeRun(run.id, {
      status: errors.length > 0 && allJobs.length === 0 ? "failed" : "completed",
      completedAt: new Date(),
      jobsFound: savedJobs.length,
      error: errors.length > 0 ? errors.join("; ") : null,
    });

    log(`Scrape completed: ${savedJobs.length} jobs found`, "scraper");
    return { runId: run.id, jobs: jobsWithRunId };
  } catch (error: any) {
    await storage.updateScrapeRun(run.id, {
      status: "failed",
      completedAt: new Date(),
      error: error.message,
    });
    throw error;
  }
}
