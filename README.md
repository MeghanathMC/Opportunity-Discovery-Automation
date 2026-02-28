# Opportunity Scout: PM Job Discovery for Airtribe Career Services

## What I Built and How It Works

I built **Opportunity Scout**, an automated job discovery platform tailored specifically for the Airtribe Career Services team to find and aggregate early-career Product Manager (PM) and Product Analyst roles for learners.

Instead of manually checking communities, channels, and job boards every day, this tool fully automates the process by scraping live listings across multiple job sources and outputting a clean, structured digest.

<img width="1599" height="845" alt="image" src="https://github.com/user-attachments/assets/cf702929-e6be-4711-89cd-cf836964a4dc" />

<img width="1814" height="850" alt="image" src="https://github.com/user-attachments/assets/f8d41973-ca18-40b1-ab90-a88c7f7cd53d" />



**How it works:**
1. **Configurable Dashboard:** The Airtribe team uses a simple React frontend to define exact criteria: job titles (e.g., "APM", "Junior PM"), target locations (India or Remote), search timeframes, and maximum jobs per run.
2. **Scraper Engine:** When a run is triggered, the Express.js backend receives these configurations and dynamically prepares search queries.
3. **Data Extraction:** The backend orchestrates robust third-party scraping actors to pull live data from 4 distinct job boards simultaneously.
4. **Processing & Deduplication:** The fetched data is instantly filtered for relevance, deduplicated against previously found URLs (to maintain a high signal-to-noise ratio), and stored securely in a PostgreSQL database.
5. **Insights & structured Digest:** The dashboard updates to show the new jobs, explicitly highlighting the exact role, company, source, link, and *why* it was flagged as relevant based on Airtribe parameters. Results can be instantly exported to CSV for sharing.

## Tools, APIs, and Models Used

The architecture is built as a robust full-stack system focused on real-time data pulling and accurate filtering to maximize the signal-to-noise ratio:

*   **Frontend**: Built with **React** and **TypeScript**, styled via **Tailwind CSS** and **Shadcn UI**.
*   **Backend server**: **Node.js/Express.js** handling the REST API, scraping orchestration, and processing.
*   **Database**: **PostgreSQL** (hosted on Neon), interfaced using **Drizzle ORM** for fully typed schema migrations.

### Source Selection & Rationale
To ensure we capture early-career PM roles effectively, I selected 4 distinct channels, orchestrated heavily via the **Apify API**:
1.  **LinkedIn Jobs**: Essential. This is the largest professional network where companies officially post corporate roles, particularly larger tech and enterprise opportunities.
2.  **Wellfound / AngelList**: The premier platform for startup hiring. Early-stage companies heavily recruit entry-level PMs here, and they often offer remote flexibility. 
3.  **Indeed**: A high-volume generic job board that often catches traditional companies, agencies, and non-tech sectors that need PMs but don't heavily use LinkedIn or Wellfound.
4.  **Naukri**: Critical for the Indian market specifically. Many prominent Indian conglomerates and IT service companies post entry-level PM roles exclusively here.

## What I'd Improve with More Time

Given more time to scale the product for the Career Services team, I would focus heavily on automation and deeper filtering:

1. **Automated Cron Scheduling**: I would implement automated CRON jobs using a service like Trigger.dev or GitHub Actions so the scrapers run completely headlessly in the background every 12 or 24 hours without any user intervention.
2. **Real-time Slack Notifications**: As soon as the scheduled cron job discovers a new job that meets the criteria, I would ping the structured message (Role, Company, Link, Reason) directly to the Career Services Slack channel so the team is immediately notified without needing to check the dashboard.
3. **Expanding the Discovery Funnel (Discord, Twitter, etc.)**: Beyond traditional job boards (LinkedIn, Indeed), the highest-signal opportunities often come from community networks. I would build custom scrapers or integrate bot webhooks to pull raw data directly from **Twitter/X**, targeted **Discord** communities, and niche **Slack** groups where founders hire directly.
