import { type InsertJob } from "@shared/schema";
import { storage } from "./storage";
import { log } from "./index";

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const APIFY_BASE_URL = "https://api.apify.com/v2";

const TARGET_TITLES = [
  "associate product manager",
  "assistant product manager",
  "junior product manager",
  "entry-level product manager",
  "entry level product manager",
  "apm",
];

const OPTIONAL_TITLES = [
  "product analyst",
  "product associate",
];

const INDIA_LOCATIONS = [
  "india",
  "bangalore",
  "bengaluru",
  "mumbai",
  "delhi",
  "hyderabad",
  "pune",
  "chennai",
  "kolkata",
  "gurgaon",
  "gurugram",
  "noida",
  "ahmedabad",
  "jaipur",
  "chandigarh",
  "kochi",
  "thiruvananthapuram",
];

function isRelevantTitle(title: string, includeProductAnalyst: boolean): boolean {
  const lower = title.toLowerCase();
  const allTitles = includeProductAnalyst
    ? [...TARGET_TITLES, ...OPTIONAL_TITLES]
    : TARGET_TITLES;
  return allTitles.some((t) => lower.includes(t));
}

function isRelevantLocation(location: string): boolean {
  const lower = location.toLowerCase();
  if (INDIA_LOCATIONS.some((loc) => lower.includes(loc))) return true;
  if (lower.includes("remote") || lower.includes("anywhere") || lower.includes("work from home") || lower.includes("wfh")) return true;
  return false;
}

function getRelevanceReason(title: string, location: string, source: string): string {
  const reasons: string[] = [];
  const lowerTitle = title.toLowerCase();
  const lowerLoc = location.toLowerCase();

  if (lowerTitle.includes("associate product manager") || lowerTitle.includes("apm")) {
    reasons.push("APM role - ideal entry-level PM position");
  } else if (lowerTitle.includes("assistant product manager")) {
    reasons.push("Assistant PM - early-career PM opportunity");
  } else if (lowerTitle.includes("junior product manager")) {
    reasons.push("Junior PM - entry-level product management");
  } else if (lowerTitle.includes("entry")) {
    reasons.push("Entry-level PM position");
  } else if (lowerTitle.includes("product analyst")) {
    reasons.push("Product Analyst - adjacent PM-track role");
  } else if (lowerTitle.includes("product associate")) {
    reasons.push("Product Associate - PM-adjacent role");
  }

  if (INDIA_LOCATIONS.some((loc) => lowerLoc.includes(loc))) {
    reasons.push("India-based location");
  } else if (lowerLoc.includes("remote") || lowerLoc.includes("anywhere")) {
    reasons.push("Remote/global position");
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
    const maxAttempts = 60;

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
      log(`Actor run status: ${status} (attempt ${attempts})`, "scraper");
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

async function scrapeIndeed(includeProductAnalyst: boolean): Promise<InsertJob[]> {
  const searchQueries = [
    "associate product manager",
    "junior product manager",
    "APM product manager",
  ];
  if (includeProductAnalyst) {
    searchQueries.push("product analyst entry level");
  }

  const allJobs: InsertJob[] = [];

  for (const query of searchQueries) {
    try {
      const items = await runApifyActor("hKByXkMQaC5Qt9UMN", {
        country: "IN",
        location: "India",
        maxItems: 15,
        parseCompany: true,
        position: query,
        saveOnlyUniqueItems: true,
        followApplyRedirects: false,
      });

      for (const item of items) {
        const title = item.positionName || item.title || "";
        const company = item.company || item.companyName || "Unknown";
        const location = item.location || item.jobLocation || "India";
        const url = item.url || item.externalApplyLink || "";
        const postedDate = item.postedAt || item.scrapedAt || "";
        const salary = item.salary || "";
        const description = item.description?.substring(0, 500) || "";

        if (!title || !url) continue;
        if (!isRelevantTitle(title, includeProductAnalyst)) continue;
        if (!isRelevantLocation(location)) continue;

        const isDuplicate = await storage.isDuplicateJob(url);
        if (isDuplicate) continue;

        allJobs.push({
          title,
          company,
          location,
          source: "Indeed",
          url,
          postedDate,
          relevanceReason: getRelevanceReason(title, location, "Indeed"),
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

async function scrapeLinkedIn(includeProductAnalyst: boolean): Promise<InsertJob[]> {
  const searchQueries = [
    "associate product manager India",
    "junior product manager India",
    "APM India",
  ];
  if (includeProductAnalyst) {
    searchQueries.push("product analyst India");
  }

  const allJobs: InsertJob[] = [];

  for (const query of searchQueries) {
    try {
      const items = await runApifyActor("BHzDUfc6gjnse8RcT", {
        searchUrl: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(query)}&location=India&f_TPR=r604800`,
        scrapeCompany: false,
        startPage: 1,
        count: 15,
        proxy: {
          useApifyProxy: true,
          apifyProxyGroups: ["RESIDENTIAL"],
        },
        minDelay: 2,
        maxDelay: 5,
      });

      for (const item of items) {
        const title = item.title || item.jobTitle || "";
        const company = item.companyName || item.company || "Unknown";
        const location = item.location || item.place || "India";
        const url = item.jobUrl || item.url || item.link || "";
        const postedDate = item.postedAt || item.publishedAt || item.listedAt || "";
        const salary = item.salary || "";
        const description = item.description?.substring(0, 500) || "";

        if (!title || !url) continue;
        if (!isRelevantTitle(title, includeProductAnalyst)) continue;

        const isDuplicate = await storage.isDuplicateJob(url);
        if (isDuplicate) continue;

        allJobs.push({
          title,
          company,
          location,
          source: "LinkedIn",
          url,
          postedDate: postedDate ? String(postedDate) : null,
          relevanceReason: getRelevanceReason(title, location, "LinkedIn"),
          runId: null,
          salary: salary || null,
          description: description || null,
        });
      }
    } catch (error: any) {
      log(`Error scraping LinkedIn for "${query}": ${error.message}`, "scraper");
    }
  }

  return allJobs;
}

async function scrapeLinkedInPosts(includeProductAnalyst: boolean): Promise<InsertJob[]> {
  const allJobs: InsertJob[] = [];

  try {
    const items = await runApifyActor("2SyF0bVxmgGr8IVCZ", {
      urls: [
        "https://www.linkedin.com/search/results/content/?keywords=hiring%20associate%20product%20manager%20india&datePosted=%22past-week%22",
        "https://www.linkedin.com/search/results/content/?keywords=hiring%20APM%20india&datePosted=%22past-week%22",
      ],
      deepScrape: false,
      maxItems: 20,
      proxy: {
        useApifyProxy: true,
        apifyProxyGroups: ["RESIDENTIAL"],
      },
    });

    for (const item of items) {
      const text = item.text || item.postText || item.content || "";
      const url = item.postUrl || item.url || "";
      const authorName = item.authorName || item.author || "";

      if (!text || !url) continue;

      const lowerText = text.toLowerCase();
      const hasRelevantTitle = TARGET_TITLES.some((t) => lowerText.includes(t)) ||
        (includeProductAnalyst && OPTIONAL_TITLES.some((t) => lowerText.includes(t)));
      const hasHiringSignal = lowerText.includes("hiring") || lowerText.includes("opening") ||
        lowerText.includes("looking for") || lowerText.includes("join") ||
        lowerText.includes("apply") || lowerText.includes("opportunity");

      if (!hasRelevantTitle || !hasHiringSignal) continue;

      const isDuplicate = await storage.isDuplicateJob(url);
      if (isDuplicate) continue;

      const companyMatch = text.match(/(?:at|@)\s+([A-Z][a-zA-Z\s&]+)/);
      const company = companyMatch ? companyMatch[1].trim() : authorName || "See Post";

      allJobs.push({
        title: "PM Opening (from LinkedIn post)",
        company,
        location: "India / Remote",
        source: "LinkedIn Posts",
        url,
        postedDate: item.postedAt || null,
        relevanceReason: "Hiring post mentioning PM roles | Found via LinkedIn content search",
        runId: null,
        salary: null,
        description: text.substring(0, 500),
      });
    }
  } catch (error: any) {
    log(`Error scraping LinkedIn posts: ${error.message}`, "scraper");
  }

  return allJobs;
}

export async function runScrapeJob(
  sources: string[],
  includeProductAnalyst: boolean,
  maxJobs: number = 40
): Promise<{ runId: number; jobs: InsertJob[] }> {
  const run = await storage.createScrapeRun({
    sources,
    includeProductAnalyst,
    maxJobs,
  });

  await storage.updateScrapeRun(run.id, { status: "running" });

  let allJobs: InsertJob[] = [];
  const errors: string[] = [];

  try {
    const scrapers: Promise<InsertJob[]>[] = [];

    if (sources.includes("indeed")) {
      scrapers.push(scrapeIndeed(includeProductAnalyst));
    }
    if (sources.includes("linkedin")) {
      scrapers.push(scrapeLinkedIn(includeProductAnalyst));
    }
    if (sources.includes("linkedin_posts")) {
      scrapers.push(scrapeLinkedInPosts(includeProductAnalyst));
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
