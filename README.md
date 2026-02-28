# Opportunity Scout: PM Job Discovery Automation

## What I Built and How It Works

I built **Opportunity Scout**, an automated job discovery platform designed specifically for finding and aggregating early-career Product Manager (PM) and Product Analyst roles. 

Instead of manually checking multiple job platforms every day, this tool automates the process by scraping live listings across the most popular job boards based on highly customizable parameters.

**How it works:**
1. **Configurable Dashboard:** The user interacts with a modern React frontend to define their "Discovery Settings," such as specific job titles (e.g., "APM", "Junior PM"), target locations (or "Remote"), search timeframes, and job platforms.
2. **Scraper Engine:** When a run is triggered, the Express.js backend receives these configurations and dynamically prepares API calls.
3. **Data Extraction:** The backend orchestrates third-party scraping actors to pull live data from Indeed, LinkedIn, Wellfound, and Naukri.
4. **Processing & Deduplication:** The fetched data is instantly filtered for relevance, deduplicated against previously found URLs, and stored securely in a PostgreSQL database.
5. **Insights:** The dashboard instantly updates to show the new jobs, highlighting matching reasons, salary information (where available), and tracking overall discovery metrics over time. Results can easily be exported to CSV.

## Tools, APIs, and Models Used

The architecture was built entirely as a full-stack automated platform rather than an LLM-wrapper, prioritizing fast, reliable real-time data pulling:

*   **Frontend**: Built with **React** and **TypeScript**, bundled via **Vite**. UI styling is achieved seamlessly through **Tailwind CSS** and customized Radix **Shadcn UI** components.
*   **Backend engine**: A robust **Node.js/Express.js** server handling the REST API, scraping orchestration, and job data processing.
*   **Database**: **PostgreSQL** (hosted on Neon), interfaced using the **Drizzle ORM** for fully typed queries and schema migrations.

## What I'd Improve with More Time

Given more time to scale the product, I would introduce the following major features:

1. **Automated Cron Scheduling**: Allowing users to set up scheduled daily or weekly background runs so that new opportunities are continually pulled without needing to manually click "Run Discovery".
2. **AI-Powered Description Analysis**: Passing the scraped job descriptions through an LLM (such as Gemini or Claude) to automatically summarize the required skills, deduce whether it is truly entry-level, and extract hidden salary ranges.
3. **Email/Slack Alerts**: Implementing a notification system (via Resend or Slack Webhooks) to alert the user immediately when a high-relevance "Unseen" job is discovered.
4. **Enhanced User Authentication**: Moving from local session-based auth to a modern OAuth flow (e.g., Google or LinkedIn login) to support a multi-tenant SaaS architecture where multiple users have separate tracked workspaces.
