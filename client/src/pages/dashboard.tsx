import { useState, useMemo, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  Trash2,
  Save,
  Plus,
  Copy,
} from "lucide-react";
import { SiLinkedin, SiIndeed, SiWellfound } from "react-icons/si";
import { format, formatDistanceToNow } from "date-fns";

const DISCOVERY_SETTINGS_KEY = "opportunity-scout-discovery-settings";

function getStoredDiscoverySettings() {
  try {
    const stored = localStorage.getItem(DISCOVERY_SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        selectedSources: Array.isArray(parsed.selectedSources)
          ? parsed.selectedSources
          : undefined,
        includeProductAnalyst:
          typeof parsed.includeProductAnalyst === "boolean"
            ? parsed.includeProductAnalyst
            : undefined,
        targetRoles: Array.isArray(parsed.targetRoles)
          ? parsed.targetRoles
          : undefined,
        locationsInput:
          typeof parsed.locationsInput === "string"
            ? parsed.locationsInput
            : undefined,
        timePeriod:
          typeof parsed.timePeriod === "string" ? parsed.timePeriod : undefined,
        maxJobs:
          typeof parsed.maxJobs === "string" ? parsed.maxJobs : undefined,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

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

function sourceBadgeVariant(
  source: string,
): "default" | "secondary" | "outline" {
  const lower = source.toLowerCase();
  if (lower.includes("linkedin")) return "default";
  if (lower.includes("indeed")) return "secondary";
  return "outline";
}

function StatusCircle({ status }: { status: string }) {
  if (status === "interested")
    return (
      <div className="w-2 h-2 rounded-full bg-yellow-500" title="Interested" />
    );
  if (status === "applied")
    return (
      <div className="w-2 h-2 rounded-full bg-green-500" title="Applied" />
    );
  if (status === "rejected")
    return <div className="w-2 h-2 rounded-full bg-red-500" title="Rejected" />;
  return (
    <div className="w-2 h-2 rounded-full bg-slate-300" title="Discovered" />
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "completed") {
    return (
      <Badge variant="default">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        Completed
      </Badge>
    );
  }
  if (status === "running") {
    return (
      <Badge variant="secondary">
        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
        Running
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge variant="destructive">
        <AlertCircle className="w-3 h-3 mr-1" />
        Failed
      </Badge>
    );
  }
  return <Badge variant="outline">{status}</Badge>;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: any;
  label: string;
  value: string | number;
  sub?: string;
}) {
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

function JobCard({
  job,
  onStatusChange,
  onCopyLink,
}: {
  job: Job;
  onStatusChange: (id: number, status: string) => void;
  onCopyLink?: (url: string) => void;
}) {
  return (
    <Card className="hover-elevate transition-all duration-200">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {job.isNew && (
                <Badge variant="default" className="text-[10px] px-1.5 py-0">
                  <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                  NEW
                </Badge>
              )}
              <Badge variant={sourceBadgeVariant(job.source)}>
                <SourceIcon source={job.source} />
                <span className="ml-1">{job.source}</span>
              </Badge>
            </div>

            <h3
              className="font-semibold text-base leading-snug"
              data-testid={`text-job-title-${job.id}`}
            >
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
              <p className="text-sm font-medium text-foreground/80">
                {job.salary}
              </p>
            )}

            <div className="flex items-start gap-1.5 mt-1">
              <Zap className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                {job.relevanceReason}
              </p>
            </div>

            {job.description && (
              <p className="text-xs text-muted-foreground/70 line-clamp-2 mt-1">
                {job.description}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={() => {
                    const nextStatus =
                      job.status === "discovered"
                        ? "interested"
                        : job.status === "interested"
                          ? "applied"
                          : job.status === "applied"
                            ? "rejected"
                            : "discovered";
                    onStatusChange(job.id, nextStatus);
                  }}
                >
                  <StatusCircle status={job.status} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Status:{" "}
                {(job.status || "discovered").charAt(0).toUpperCase() +
                  (job.status || "discovered").slice(1)}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
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

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={() => onCopyLink?.(job.url)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy job link</TooltipContent>
            </Tooltip>
          </div>
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

function RunHistoryItem({
  run,
  onDelete,
  isDeleting,
  isActive,
  onSelect,
}: {
  run: ScrapeRun;
  onDelete: (id: number) => void;
  isDeleting?: boolean;
  isActive?: boolean;
  onSelect?: (run: ScrapeRun) => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`flex items-center justify-between gap-3 py-3 px-2 group cursor-pointer rounded-md ${
            isActive ? "bg-muted" : "hover:bg-muted/60"
          }`}
          onClick={() => onSelect?.(run)}
          role="button"
          tabIndex={0}
        >
          <div className="flex items-center gap-3 w-full">
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <StatusBadge status={run.status} />
                  <span className="text-xs font-medium text-foreground truncate">
                    {run.sources.join(", ")}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-sm font-semibold">{run.jobsFound}</span>
                  <span className="ml-1 text-xs text-muted-foreground">
                    jobs
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(run.startedAt), {
                  addSuffix: true,
                })}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete(run.id);
              }}
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs space-y-1">
        <p className="font-medium">Run details</p>
        <p>Started: {format(new Date(run.startedAt), "PPpp")}</p>
        {run.completedAt && (
          <p>Finished: {format(new Date(run.completedAt), "PPpp")}</p>
        )}
        <p>Jobs found: {run.jobsFound}</p>
        <p>Sources: {run.sources.join(", ")}</p>
        <p>Time window: last {run.timePeriod} days</p>
      </TooltipContent>
    </Tooltip>
  );
}

export default function Dashboard() {
  const { toast } = useToast();
  const stored = useMemo(() => getStoredDiscoverySettings(), []);
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [includeProductAnalyst, setIncludeProductAnalyst] = useState(
    stored?.includeProductAnalyst ?? false,
  );
  const [selectedSources, setSelectedSources] = useState<string[]>(
    stored?.selectedSources ?? ["indeed", "linkedin"],
  );
  const [targetRoles, setTargetRoles] = useState<string[]>(
    stored?.targetRoles ?? [
      "APM",
      "Junior PM",
      "Assistant PM",
      "Entry-Level PM",
    ],
  );
  const [customRole, setCustomRole] = useState("");
  const [locationsInput, setLocationsInput] = useState<string>(
    stored?.locationsInput ?? "India, Remote",
  );
  const [timePeriod, setTimePeriod] = useState<string>(
    stored?.timePeriod ?? "7",
  );
  const [maxJobs, setMaxJobs] = useState<string>(stored?.maxJobs ?? "40");
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const jobsQueryUrl = (() => {
    const params = new URLSearchParams();
    if (sourceFilter !== "all") params.set("source", sourceFilter);
    if (searchQuery) params.set("search", searchQuery);
    if (selectedRunId != null) params.set("runId", String(selectedRunId));
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    const qs = params.toString();
    return qs ? `/api/jobs?${qs}` : "/api/jobs";
  })();

  const { data: jobs, isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ["jobs", jobsQueryUrl],
    queryFn: async () => {
      const res = await apiRequest("GET", jobsQueryUrl);
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["/api/stats"],
    refetchInterval: 30000,
  });

  const { data: runs, isLoading: runsLoading } = useQuery<ScrapeRun[]>({
    queryKey: ["/api/runs"],
    refetchInterval: 30000,
  });

  const { data: latestRun } = useQuery<ScrapeRun | null>({
    queryKey: ["/api/runs/latest"],
    refetchInterval: 3000,
  });

  const scrapeMutation = useMutation({
    mutationFn: async () => {
      const locations = locationsInput
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean);
      const res = await apiRequest("POST", "/api/scrape", {
        sources: selectedSources,
        includeProductAnalyst,
        maxJobs: parseInt(maxJobs) || 40,
        locations: locations.length > 0 ? locations : ["India", "Remote"],
        targetRoles: targetRoles.length > 0 ? targetRoles : ["APM"],
        timePeriod: parseInt(timePeriod) || 7,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Scrape started",
        description:
          "Pulling jobs from selected sources. This may take a few minutes.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/runs/latest"] });
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

  const deleteRunMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/runs/${id}`);
      return res;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["/api/runs"] });
      const previousRuns = queryClient.getQueryData<ScrapeRun[]>(["/api/runs"]);
      queryClient.setQueryData<ScrapeRun[]>(["/api/runs"], (old) =>
        old ? old.filter((r) => r.id !== id) : [],
      );
      return { previousRuns };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/runs/latest"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast({ title: "Run history deleted" });
    },
    onError: (error: Error, id, context) => {
      if (context?.previousRuns) {
        queryClient.setQueryData(["/api/runs"], context.previousRuns);
      }
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/runs"] });
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
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "All jobs marked as seen" });
    },
  });

  const updateJobStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await apiRequest("PATCH", `/api/jobs/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
  });

  const isRunning = latestRun?.status === "running";
  const newJobCount = jobs?.filter((j) => j.isNew).length || 0;
  const hasNextPage = (jobs?.length || 0) === pageSize;

  const toggleSource = (source: string) => {
    setSelectedSources((prev) =>
      prev.includes(source)
        ? prev.filter((s) => s !== source)
        : [...prev, source],
    );
  };

  useEffect(() => {
    setPage(1);
  }, [sourceFilter, searchQuery, selectedRunId]);

  const handleCopyJobLink = async (url: string) => {
    const text = `Here’s a PM opportunity I found for you:\n${url}`;
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Link copied",
        description: "You can now paste this job link into chat or email.",
        variant: "success",
      });
    } catch {
      toast({
        title: "Couldn’t copy link",
        description: "Please copy the link manually instead.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="flex items-center">
                <img
                  src="/airtribe-logo.png"
                  alt="Airtribe"
                  className="h-8 object-contain"
                />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight">
                  Airtribe's PM Opportunity Tracker
                </h1>
                <p className="text-xs text-muted-foreground">
                  Automated early-career PM job discovery
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      window.open("/api/export?format=csv", "_blank")
                    }
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
                disabled={
                  isRunning ||
                  scrapeMutation.isPending ||
                  selectedSources.length === 0
                }
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
              <Card key={i}>
                <CardContent className="p-5">
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))
          ) : (
            <>
              <StatCard
                icon={Briefcase}
                label="Total Jobs"
                value={stats?.totalJobs || 0}
                sub="All discovered opportunities"
              />
              <StatCard
                icon={Sparkles}
                label="New Jobs"
                value={stats?.newJobs || 0}
                sub="Unseen opportunities"
              />
              <StatCard
                icon={TrendingUp}
                label="Scrape Runs"
                value={stats?.totalRuns || 0}
                sub="Discovery sessions"
              />
              <StatCard
                icon={Globe}
                label="Sources"
                value={stats?.sources.length || 0}
                sub={stats?.sources.join(", ") || "None yet"}
              />
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
                  <Label className="text-xs text-muted-foreground">
                    Sources
                  </Label>
                  <div className="space-y-2">
                    {[
                      { id: "indeed", label: "Indeed Jobs", icon: SiIndeed },
                      {
                        id: "linkedin",
                        label: "LinkedIn Jobs",
                        icon: SiLinkedin,
                      },
                      { 
                        id: "naukri", 
                        label: "Naukri Jobs", 
                        icon: Globe, 
                        tbd: true 
                      },
                      { 
                        id: "wellfound", 
                        label: "Wellfound Jobs", 
                        icon: SiWellfound, 
                        tbd: true 
                      },
                    ].map((source) => (
                      <div
                        key={source.id}
                        className="flex items-center justify-between py-1"
                      >
                        <label
                          className={`flex items-center gap-2.5 ${source.tbd ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                          data-testid={`toggle-source-${source.id}`}
                        >
                          <Switch
                            checked={selectedSources.includes(source.id)}
                            onCheckedChange={() => !source.tbd && toggleSource(source.id)}
                            disabled={source.tbd}
                          />
                          <source.icon className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm">{source.label}</span>
                        </label>
                        {source.tbd && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-500/50 text-amber-600 bg-amber-50 dark:bg-amber-950/20">
                            TBD
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Extra Filters
                  </Label>
                  <label
                    className="flex items-center gap-2.5 cursor-pointer py-1"
                    data-testid="toggle-product-analyst"
                  >
                    <Switch
                      checked={includeProductAnalyst}
                      onCheckedChange={setIncludeProductAnalyst}
                    />
                    <span className="text-sm">
                      Include Product Analyst / Associate
                    </span>
                  </label>
                </div>

                <Separator />

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Target Roles
                  </Label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {[
                      "APM",
                      "Junior PM",
                      "Assistant PM",
                      "Entry-Level PM",
                      "Product Manager",
                    ].map((role) => (
                      <Badge
                        key={role}
                        variant={
                          targetRoles.includes(role) ? "default" : "outline"
                        }
                        className="text-[10px] cursor-pointer"
                        onClick={() => {
                          setTargetRoles((prev) =>
                            prev.includes(role)
                              ? prev.filter((r) => r !== role)
                              : [...prev, role],
                          );
                        }}
                      >
                        {role}
                      </Badge>
                    ))}
                    {targetRoles
                      .filter(
                        (r) =>
                          ![
                            "APM",
                            "Junior PM",
                            "Assistant PM",
                            "Entry-Level PM",
                            "Product Manager",
                          ].includes(r),
                      )
                      .map((role) => (
                        <Badge
                          key={role}
                          variant="default"
                          className="text-[10px] cursor-pointer"
                          onClick={() =>
                            setTargetRoles((prev) =>
                              prev.filter((r) => r !== role),
                            )
                          }
                        >
                          {role} <Trash2 className="w-2 h-2 ml-1" />
                        </Badge>
                      ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add custom role..."
                      value={customRole}
                      onChange={(e) => setCustomRole(e.target.value)}
                      className="h-8 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && customRole.trim()) {
                          if (!targetRoles.includes(customRole.trim())) {
                            setTargetRoles([...targetRoles, customRole.trim()]);
                          }
                          setCustomRole("");
                        }
                      }}
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 shrink-0"
                      onClick={() => {
                        if (
                          customRole.trim() &&
                          !targetRoles.includes(customRole.trim())
                        ) {
                          setTargetRoles([...targetRoles, customRole.trim()]);
                          setCustomRole("");
                        }
                      }}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Locations (comma separated)
                  </Label>
                  <Input
                    placeholder="e.g., Bangalore, Remote, India"
                    value={locationsInput}
                    onChange={(e) => setLocationsInput(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Time Period (days)
                  </Label>
                  <Select value={timePeriod} onValueChange={setTimePeriod}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Last 24 hours (1d)</SelectItem>
                      <SelectItem value="3">Last 3 days</SelectItem>
                      <SelectItem value="7">Last 7 days</SelectItem>
                      <SelectItem value="14">Last 14 days</SelectItem>
                      <SelectItem value="30">Last 30 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Max Jobs Per Run (1-100)
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={maxJobs}
                    onChange={(e) => setMaxJobs(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="pt-2">
                  <Button
                    variant="outline"
                    className="w-full h-8 text-xs gap-2"
                    onClick={() => {
                      try {
                        localStorage.setItem(
                          DISCOVERY_SETTINGS_KEY,
                          JSON.stringify({
                            selectedSources,
                            includeProductAnalyst,
                            targetRoles,
                            locationsInput,
                            timePeriod,
                            maxJobs,
                          }),
                        );
                        toast({
                          title: "Preferences saved",
                          description:
                            "We\u2019ll use these settings the next time we search for roles for you.",
                          variant: "success",
                        });
                      } catch {
                        toast({
                          title: "We couldn\u2019t save your preferences",
                          description: "Please try again in a moment.",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save Settings
                  </Button>
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
                      <RunHistoryItem
                        key={run.id}
                        run={run}
                        onDelete={(id) => deleteRunMutation.mutate(id)}
                        isDeleting={
                          deleteRunMutation.isPending &&
                          deleteRunMutation.variables === run.id
                        }
                        isActive={selectedRunId === run.id}
                        onSelect={(selected) => {
                          setSelectedRunId((prev) =>
                            prev === selected.id ? null : selected.id,
                          );
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <RefreshCw className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No runs yet</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Start your first discovery run
                    </p>
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
                <SelectTrigger
                  className="w-[160px]"
                  data-testid="select-source-filter"
                >
                  <SelectValue placeholder="All Sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="Indeed">Indeed</SelectItem>
                  <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                </SelectContent>
              </Select>
              {selectedRunId != null && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedRunId(null)}
                >
                  Clear run filter
                </Button>
              )}
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
                    <p className="text-sm font-medium">
                      Discovery in progress...
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Scraping job boards for PM opportunities. This typically
                      takes 2-5 minutes.
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
                    Showing{" "}
                    <span className="font-medium text-foreground">
                      {jobs.length}
                    </span>{" "}
                    opportunities
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Page{" "}
                      <span className="font-medium text-foreground">
                        {page}
                      </span>
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!hasNextPage}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
                {jobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onStatusChange={(id, status) =>
                      updateJobStatusMutation.mutate({ id, status })
                    }
                    onCopyLink={handleCopyJobLink}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-16 text-center">
                  <div className="max-w-sm mx-auto space-y-3">
                    <div className="rounded-full bg-muted w-16 h-16 flex items-center justify-center mx-auto">
                      <Briefcase className="w-7 h-7 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold">
                      No opportunities found yet
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Hit "Run Discovery" to start pulling PM job listings from
                      LinkedIn, Indeed, and more.
                    </p>
                    <Button
                      onClick={() => scrapeMutation.mutate()}
                      disabled={
                        isRunning ||
                        scrapeMutation.isPending ||
                        selectedSources.length === 0
                      }
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
