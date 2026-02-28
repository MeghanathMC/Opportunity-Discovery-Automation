import { storage } from "./storage";
import { log } from "./index";

export async function seedDatabase() {
  const existingJobs = await storage.getJobCount();
  if (existingJobs > 0) {
    log("Database already has data, skipping seed", "seed");
    return;
  }

  log("Seeding database with sample job data...", "seed");

  const run = await storage.createScrapeRun({
    sources: ["indeed", "linkedin", "linkedin_posts"],
    includeProductAnalyst: false,
    maxJobs: 40,
  });

  await storage.updateScrapeRun(run.id, {
    status: "completed",
    completedAt: new Date(),
    jobsFound: 8,
  });

  const sampleJobs = [
    {
      title: "Associate Product Manager",
      company: "Flipkart",
      location: "Bangalore, Karnataka, India",
      source: "LinkedIn",
      url: "https://www.linkedin.com/jobs/view/apm-flipkart-example",
      postedDate: "2 days ago",
      relevanceReason: "APM role - ideal entry-level PM position | India-based location | Found on LinkedIn",
      runId: run.id,
      salary: "INR 18-25 LPA",
      description: "Join Flipkart's product team as an Associate Product Manager. You'll work on consumer-facing features impacting millions of users across India. Ideal for candidates with 0-2 years of experience.",
    },
    {
      title: "Junior Product Manager - Growth",
      company: "Razorpay",
      location: "Bangalore, India",
      source: "Indeed",
      url: "https://www.indeed.com/viewjob?jk=razorpay-jpm-example",
      postedDate: "3 days ago",
      relevanceReason: "Junior PM - entry-level product management | India-based location | Found on Indeed",
      runId: run.id,
      salary: "INR 15-22 LPA",
      description: "Razorpay is looking for a Junior Product Manager to drive growth initiatives in the payments ecosystem. You'll be responsible for analyzing user behavior and shipping features that improve merchant onboarding.",
    },
    {
      title: "Associate Product Manager - Platform",
      company: "Swiggy",
      location: "Hyderabad, India",
      source: "LinkedIn",
      url: "https://www.linkedin.com/jobs/view/apm-swiggy-example",
      postedDate: "1 day ago",
      relevanceReason: "APM role - ideal entry-level PM position | India-based location | Found on LinkedIn",
      runId: run.id,
      salary: null,
      description: "Swiggy's platform team seeks an APM to work on core infrastructure products. You'll partner with engineering to define and ship features that power the delivery experience.",
    },
    {
      title: "Entry Level Product Manager",
      company: "Meesho",
      location: "Bangalore, Karnataka, India",
      source: "Indeed",
      url: "https://www.indeed.com/viewjob?jk=meesho-pm-example",
      postedDate: "5 days ago",
      relevanceReason: "Entry-level PM position | India-based location | Found on Indeed",
      runId: run.id,
      salary: "INR 12-18 LPA",
      description: "Meesho is hiring an entry-level PM to join their social commerce team. Great opportunity for recent graduates interested in building products for Bharat.",
    },
    {
      title: "PM Opening (from LinkedIn post)",
      company: "CRED",
      location: "India / Remote",
      source: "LinkedIn Posts",
      url: "https://www.linkedin.com/posts/cred-hiring-apm-example",
      postedDate: "4 days ago",
      relevanceReason: "Hiring post mentioning PM roles | Found via LinkedIn content search",
      runId: run.id,
      salary: null,
      description: "We're hiring APMs at CRED! If you're passionate about fintech and building delightful products, we want to hear from you. DM me or apply through the link below.",
    },
    {
      title: "Associate Product Manager - Remote",
      company: "Freshworks",
      location: "Remote (India)",
      source: "LinkedIn",
      url: "https://www.linkedin.com/jobs/view/apm-freshworks-example",
      postedDate: "6 days ago",
      relevanceReason: "APM role - ideal entry-level PM position | Remote/global position | Found on LinkedIn",
      runId: run.id,
      salary: "INR 16-24 LPA",
      description: "Freshworks is looking for an APM to join our SaaS product suite. This is a remote-first position open to candidates across India. You'll work on CRM and ITSM products used by thousands of businesses.",
    },
    {
      title: "Junior Product Manager - Payments",
      company: "PhonePe",
      location: "Pune, Maharashtra, India",
      source: "Indeed",
      url: "https://www.indeed.com/viewjob?jk=phonepe-jpm-example",
      postedDate: "3 days ago",
      relevanceReason: "Junior PM - entry-level product management | India-based location | Found on Indeed",
      runId: run.id,
      salary: "INR 14-20 LPA",
      description: "PhonePe is seeking a Junior PM for the payments vertical. You'll own features in the UPI ecosystem and help scale India's largest digital payments platform.",
    },
    {
      title: "Assistant Product Manager",
      company: "Zoho",
      location: "Chennai, Tamil Nadu, India",
      source: "LinkedIn",
      url: "https://www.linkedin.com/jobs/view/assistant-pm-zoho-example",
      postedDate: "2 days ago",
      relevanceReason: "Assistant PM - early-career PM opportunity | India-based location | Found on LinkedIn",
      runId: run.id,
      salary: "INR 10-15 LPA",
      description: "Zoho seeks an Assistant Product Manager to help shape our suite of productivity tools. Join a team that has built products used by over 80 million users globally.",
    },
  ];

  await storage.createJobs(sampleJobs);
  log(`Seeded ${sampleJobs.length} sample jobs`, "seed");
}
