# PM Opportunity Tracker

Automated early-career PM job discovery web application that scrapes multiple job sources and presents a clean, structured digest of relevant opportunities.

## Architecture

- **Frontend**: React + TypeScript + Tailwind CSS + Shadcn UI
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Scraping**: Apify API for LinkedIn Jobs, LinkedIn Posts, and Indeed

## Data Model

- `scrape_runs` - Tracks each scraping session (status, sources, job count)
- `jobs` - Individual job listings with title, company, location, source, URL, relevance reason

## Key Features

- Multi-source job scraping (Indeed, LinkedIn Jobs, LinkedIn Posts) via Apify
- Configurable filters: role titles, locations (India + remote), time period (7 days)
- Optional product analyst/associate toggle
- 40 jobs per run cap
- Search and filter UI
- CSV/JSON export
- Run history tracking
- Duplicate detection via URL matching
- New job indicators

## API Routes

- `GET /api/jobs` - List jobs with optional source/search filters
- `GET /api/jobs/:id` - Single job
- `POST /api/jobs/mark-seen` - Mark jobs as seen
- `GET /api/stats` - Dashboard statistics
- `GET /api/runs` - Scrape run history
- `GET /api/runs/latest` - Latest run status
- `POST /api/scrape` - Trigger new scrape job
- `GET /api/export` - Export jobs as CSV or JSON

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string
- `APIFY_TOKEN` - Apify API key for web scraping

## Apify Actors Used

- `hKByXkMQaC5Qt9UMN` - Indeed job scraper
- `BHzDUfc6gjnse8RcT` - LinkedIn jobs scraper
- `2SyF0bVxmgGr8IVCZ` - LinkedIn posts scraper
