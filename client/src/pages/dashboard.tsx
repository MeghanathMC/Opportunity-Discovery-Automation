import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { type Job, type ScrapeRun } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Search,
  Play,
  Download,
  ExternalLink,
  Briefcase,
  MapPin,
  Clock,
  Zap,
  TrendingUp,
  Globe,
  Filter,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building2,
  Sparkles,
  Eye,
} from "lucide-react";
import { SiLinkedin, SiIndeed } from "react-icons/si";
import { format, formatDistanceToNow } from "date-fns";

type Stats = {
  totalJobs: number;
  newJobs: number;
  totalRuns: number;
  sources: string[];
};

function SourceIcon({ source }: { source: string }) {
  const lower = source.toLowerCase();
  if (lower.includes("linkedin")) return <SiLinkedin className="w-3.5 h-3.5" />;
  if (lower.includes("indeed")) return <SiIndeed className="w-3.5 h-3.5" />;
  return <Globe className="w-3.5 h-3.5" />;
}

function sourceBadgeVariant(source: string): "default" | "secondary" | "outline" {
  const lower = source.toLowerCase();
  if (lower.includes("linkedin")) return "default";
  if (lower.includes("indeed")) return "secondary";
  return "outline";
}

function StatusBadge({ status }: { status: string }) {
  if (status === "completed") {
    return <Badge variant="default"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>;
  }
  if (status === "running") {
    return <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Running</Badge>;
  }
  if (status === "failed") {
    return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
  }
  return <Badge variant="outline">{status}</Badge>;
}

function StatCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold tracking-tight">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className="rounded-md bg-primary/10 p-2.5">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function JobCard({ job }: { job: Job }) {
  return (
    <Card className="hover-elevate transition-all duration-200">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {job.isNew && (
                <Badge variant="default" className="text-[10px] px-1.5 py-0">
                  <Sparkles className="w-2.5 h-2.5 mr-0.5" />NEW
                </Badge>
              )}
              <Badge variant={sourceBadgeVariant(job.source)}>
                <SourceIcon source={job.source} />
                <span className="ml-1">{job.source}</span>
              </Badge>
            </div>

            <h3 className="font-semibold text-base leading-snug" data-testid={`text-job-title-${job.id}`}>
              {job.title}
            </h3>

            <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                {job.company}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {job.location}
              </span>
              {job.postedDate && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {job.postedDate}
                </span>
              )}
            </div>

            {job.salary && (
              <p className="text-sm font-medium text-foreground/80">{job.salary}</p>
            )}

            <div className="flex items-start gap-1.5 mt-1">
              <Zap className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">{job.relevanceReason}</p>
            </div>

            {job.description && (
              <p className="text-xs text-muted-foreground/70 line-clamp-2 mt-1">{job.description}</p>
            )}
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                asChild
                data-testid={`button-view-job-${job.id}`}
              >
                <a href={job.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4" />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open job listing</TooltipContent>
          </Tooltip>
        </div>
      </CardContent>
    </Card>
  );
}

function JobCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="h-5 w-3/4" />
        <div className="flex gap-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-3 w-full" />
      </CardContent>
    </Card>
  );
}

function RunHistoryItem({ run }: { run: ScrapeRun }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <StatusBadge status={run.status} />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">
            {run.sources.join(", ")}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}
          </p>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold">{run.jobsFound}</p>
        <p className="text-xs text-muted-foreground">jobs</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [includeProductAnalyst, setIncludeProductAnalyst] = useState(false);
  const [selectedSources, setSelectedSources] = useState<string[]>(["indeed", "linkedin"]);

  const jobsQueryUrl = (() => {
    const params = new URLSearchParams();
    if (sourceFilter !== "all") params.set("source", sourceFilter);
    if (searchQuery) params.set("search", searchQuery);
    const qs = params.toString();
    return qs ? `/api/jobs?${qs}` : "/api/jobs";
  })();

  const { data: jobs, isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: [jobsQueryUrl],
    refetchInterval: 10000,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["/api/stats"],
    refetchInterval: 10000,
  });

  const { data: runs, isLoading: runsLoading } = useQuery<ScrapeRun[]>({
    queryKey: ["/api/runs"],
    refetchInterval: 5000,
  });

  const { data: latestRun } = useQuery<ScrapeRun | null>({
    queryKey: ["/api/runs/latest"],
    refetchInterval: 3000,
  });

  const scrapeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/scrape", {
        sources: selectedSources,
        includeProductAnalyst,
        maxJobs: 40,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Scrape started",
        description: "Pulling jobs from selected sources. This may take a few minutes.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Scrape failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const markSeenMutation = useMutation({
    mutationFn: async () => {
      const newJobs = jobs?.filter((j) => j.isNew) || [];
      if (newJobs.length === 0) return;
      await apiRequest("POST", "/api/jobs/mark-seen", {
        ids: newJobs.map((j) => j.id),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [jobsQueryUrl] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "All jobs marked as seen" });
    },
  });

  const isRunning = latestRun?.status === "running";
  const newJobCount = jobs?.filter((j) => j.isNew).length || 0;

  const toggleSource = (source: string) => {
    setSelectedSources((prev) =>
      prev.includes(source)
        ? prev.filter((s) => s !== source)
        : [...prev, source]
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-primary p-2">
                <Briefcase className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight">PM Opportunity Tracker</h1>
                <p className="text-xs text-muted-foreground">Automated early-career PM job discovery</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open("/api/export?format=csv", "_blank")}
                    disabled={!jobs?.length}
                    data-testid="button-export-csv"
                  >
                    <Download className="w-4 h-4 mr-1.5" />
                    CSV
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export all jobs as CSV</TooltipContent>
              </Tooltip>
              <Button
                onClick={() => scrapeMutation.mutate()}
                disabled={isRunning || scrapeMutation.isPending || selectedSources.length === 0}
                data-testid="button-start-scrape"
              >
                {isRunning || scrapeMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-1.5" />
                )}
                {isRunning ? "Scraping..." : "Run Discovery"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))
          ) : (
            <>
              <StatCard icon={Briefcase} label="Total Jobs" value={stats?.totalJobs || 0} sub="All discovered opportunities" />
              <StatCard icon={Sparkles} label="New Jobs" value={stats?.newJobs || 0} sub="Unseen opportunities" />
              <StatCard icon={TrendingUp} label="Scrape Runs" value={stats?.totalRuns || 0} sub="Discovery sessions" />
              <StatCard icon={Globe} label="Sources" value={stats?.sources.length || 0} sub={stats?.sources.join(", ") || "None yet"} />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Discovery Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Sources</Label>
                  <div className="space-y-2">
                    {[
                      { id: "indeed", label: "Indeed Jobs", icon: SiIndeed },
                      { id: "linkedin", label: "LinkedIn Jobs", icon: SiLinkedin },
                    ].map((source) => (
                      <label
                        key={source.id}
                        className="flex items-center gap-2.5 cursor-pointer py-1"
                        data-testid={`toggle-source-${source.id}`}
                      >
                        <Switch
                          checked={selectedSources.includes(source.id)}
                          onCheckedChange={() => toggleSource(source.id)}
                        />
                        <source.icon className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-sm">{source.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Extra Filters</Label>
                  <label className="flex items-center gap-2.5 cursor-pointer py-1" data-testid="toggle-product-analyst">
                    <Switch
                      checked={includeProductAnalyst}
                      onCheckedChange={setIncludeProductAnalyst}
                    />
                    <span className="text-sm">Include Product Analyst / Associate</span>
                  </label>
                </div>

                <Separator />

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Target Roles</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {["APM", "Junior PM", "Assistant PM", "Entry-Level PM"].map((role) => (
                      <Badge key={role} variant="outline" className="text-[10px]">{role}</Badge>
                    ))}
                    {includeProductAnalyst && (
                      <>
                        <Badge variant="outline" className="text-[10px]">Product Analyst</Badge>
                        <Badge variant="outline" className="text-[10px]">Product Associate</Badge>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Locations</Label>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-[10px]">India (All cities)</Badge>
                    <Badge variant="outline" className="text-[10px]">Remote / Global</Badge>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Time Period</Label>
                  <Badge variant="outline" className="text-[10px]">Last 7 days</Badge>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Max Jobs Per Run</Label>
                  <Badge variant="secondary" className="text-[10px]">40 jobs</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Run History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {runsLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : runs && runs.length > 0 ? (
                  <div className="divide-y">
                    {runs.slice(0, 5).map((run) => (
                      <RunHistoryItem key={run.id} run={run} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <RefreshCw className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No runs yet</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Start your first discovery run</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3 space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by title, company, or location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-[160px]" data-testid="select-source-filter">
                  <SelectValue placeholder="All Sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="Indeed">Indeed</SelectItem>
                  <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                  <SelectItem value="LinkedIn Posts">LinkedIn Posts</SelectItem>
                </SelectContent>
              </Select>
              {newJobCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => markSeenMutation.mutate()}
                  disabled={markSeenMutation.isPending}
                  data-testid="button-mark-seen"
                >
                  <Eye className="w-4 h-4 mr-1.5" />
                  Mark all seen ({newJobCount})
                </Button>
              )}
            </div>

            {isRunning && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4 flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  <div>
                    <p className="text-sm font-medium">Discovery in progress...</p>
                    <p className="text-xs text-muted-foreground">
                      Scraping job boards for PM opportunities. This typically takes 2-5 minutes.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {jobsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <JobCardSkeleton key={i} />
                ))}
              </div>
            ) : jobs && jobs.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing <span className="font-medium text-foreground">{jobs.length}</span> opportunities
                  </p>
                </div>
                {jobs.map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-16 text-center">
                  <div className="max-w-sm mx-auto space-y-3">
                    <div className="rounded-full bg-muted w-16 h-16 flex items-center justify-center mx-auto">
                      <Briefcase className="w-7 h-7 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold">No opportunities found yet</h3>
                    <p className="text-sm text-muted-foreground">
                      Hit "Run Discovery" to start pulling PM job listings from LinkedIn, Indeed, and more.
                    </p>
                    <Button
                      onClick={() => scrapeMutation.mutate()}
                      disabled={isRunning || scrapeMutation.isPending || selectedSources.length === 0}
                      data-testid="button-start-scrape-empty"
                    >
                      <Play className="w-4 h-4 mr-1.5" />
                      Start First Discovery
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
