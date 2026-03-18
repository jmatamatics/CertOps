"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  BarChart3,
  ArrowLeft,
  Download,
  CheckCircle,
  XCircle,
  ChevronDown,
  Users,
  TrendingUp,
  Clock,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  getResultsSummary,
  getProgramResults,
  exportProgramResults,
} from "@/lib/api";
import type { ResultsSummary, LearnerResult, DomainProficiency } from "@/lib/types";

function PassRateBar({ passed, total }: { passed: number; total: number }) {
  const pct = total > 0 ? (passed / total) * 100 : 0;
  const color =
    pct >= 80
      ? "bg-green-500"
      : pct >= 50
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">Pass rate</span>
        <span className="text-xs font-medium">{pct.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted/30 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function DomainBar({
  domain,
  prof,
}: {
  domain: string;
  prof: DomainProficiency;
}) {
  const pct = ((prof.score - 1) / 2) * 100;
  const color =
    prof.score >= 2.5
      ? "bg-green-500"
      : prof.score >= 1.7
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground truncate mr-2">
          {domain}
        </span>
        <span className="text-xs font-medium shrink-0">
          {prof.score.toFixed(1)}
        </span>
      </div>
      <div className="h-1 w-full rounded-full bg-muted/30 overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
    </div>
  );
}

function LearnerRow({
  result,
  index,
}: {
  result: LearnerResult;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const domains = Object.entries(result.domain_breakdown || {});

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.25 }}
      className="rounded-lg border border-border/50 overflow-hidden"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-card/50 transition-colors"
      >
        {result.passed ? (
          <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
        ) : (
          <XCircle className="h-4 w-4 text-red-500 shrink-0" />
        )}

        <span className="text-sm font-medium flex-1 min-w-0 truncate">
          {result.learner_id}
        </span>

        <span className="text-xs text-muted-foreground shrink-0">
          {new Date(result.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </span>

        <Badge
          variant="outline"
          className={`text-[10px] shrink-0 ${
            result.passed
              ? "border-green-500/30 text-green-400"
              : "border-red-500/30 text-red-400"
          }`}
        >
          {result.overall_score.toFixed(1)}
        </Badge>

        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 space-y-3 border-t border-border/50">
              {domains.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-xs font-medium text-muted-foreground">
                    Domain Breakdown
                  </h5>
                  {domains.map(([d, p]) => (
                    <DomainBar key={d} domain={d} prof={p} />
                  ))}
                </div>
              )}

              {result.summary && (
                <div className="rounded-md bg-primary/5 border border-primary/20 p-3">
                  <h5 className="text-xs font-medium mb-1">Summary</h5>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {result.summary}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const COLORS = {
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
  rose: "#fb7185",
  muted: "#71717a",
  cardBg: "#262626",
};

const chartTooltipStyle = {
  contentStyle: {
    backgroundColor: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: "8px",
    fontSize: "12px",
    color: "#fafafa",
  },
  itemStyle: { color: "#fafafa" },
};

function ProgramAnalytics({ results }: { results: LearnerResult[] }) {
  const stats = useMemo(() => {
    const uniqueLearners = new Set(results.map((r) => r.learner_id)).size;
    const passed = results.filter((r) => r.passed).length;
    const failed = results.length - passed;
    const passRate = results.length > 0 ? (passed / results.length) * 100 : 0;
    const avgScore =
      results.length > 0
        ? results.reduce((s, r) => s + r.overall_score, 0) / results.length
        : 0;

    const domainScores: Record<string, { total: number; count: number; novice: number; competent: number; expert: number }> = {};
    for (const r of results) {
      for (const [domain, prof] of Object.entries(r.domain_breakdown || {})) {
        if (!domainScores[domain]) {
          domainScores[domain] = { total: 0, count: 0, novice: 0, competent: 0, expert: 0 };
        }
        domainScores[domain].total += prof.score;
        domainScores[domain].count += 1;
        if (prof.score >= 2.5) domainScores[domain].expert += 1;
        else if (prof.score >= 1.7) domainScores[domain].competent += 1;
        else domainScores[domain].novice += 1;
      }
    }

    const domainAvgs = Object.entries(domainScores).map(([name, d]) => ({
      name,
      avg: Math.round((d.total / d.count) * 100) / 100,
      novice: d.novice,
      competent: d.competent,
      expert: d.expert,
    }));

    const allDomainAvg =
      domainAvgs.length > 0
        ? domainAvgs.reduce((s, d) => s + d.avg, 0) / domainAvgs.length
        : 0;

    const scoreBuckets = [
      { range: "1.0–1.5", count: 0 },
      { range: "1.5–2.0", count: 0 },
      { range: "2.0–2.5", count: 0 },
      { range: "2.5–3.0", count: 0 },
    ];
    for (const r of results) {
      const s = r.overall_score;
      if (s < 1.5) scoreBuckets[0].count += 1;
      else if (s < 2.0) scoreBuckets[1].count += 1;
      else if (s < 2.5) scoreBuckets[2].count += 1;
      else scoreBuckets[3].count += 1;
    }

    const dayMap: Record<string, { total: number; passed: number }> = {};
    for (const r of results) {
      const day = new Date(r.created_at).toISOString().slice(0, 10);
      if (!dayMap[day]) dayMap[day] = { total: 0, passed: 0 };
      dayMap[day].total += 1;
      if (r.passed) dayMap[day].passed += 1;
    }
    const trends = Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({
        date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        passRate: Math.round((d.passed / d.total) * 100),
        attempts: d.total,
      }));

    return {
      uniqueLearners,
      passed,
      failed,
      passRate,
      avgScore,
      allDomainAvg,
      domainAvgs,
      scoreBuckets,
      trends,
    };
  }, [results]);

  const pieData = [
    { name: "Passed", value: stats.passed },
    { name: "Failed", value: stats.failed },
  ];

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Unique Learners",
            value: stats.uniqueLearners,
            icon: Users,
            color: "text-rose-400",
          },
          {
            label: "Pass Rate",
            value: `${stats.passRate.toFixed(0)}%`,
            icon: Target,
            color: stats.passRate >= 70 ? "text-green-400" : stats.passRate >= 50 ? "text-amber-400" : "text-red-400",
          },
          {
            label: "Avg Score",
            value: stats.avgScore.toFixed(2),
            icon: TrendingUp,
            color: "text-blue-400",
          },
          {
            label: "Avg Domain Score",
            value: stats.allDomainAvg.toFixed(2),
            icon: BarChart3,
            color: "text-violet-400",
          },
        ].map((kpi) => (
          <Card key={kpi.label} className="border-border/30">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {kpi.label}
                </span>
              </div>
              <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row 1: Donut + Domain Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pass / Fail Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200} style={{ background: "transparent" }}>
              <PieChart style={{ background: "transparent" }}>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                >
                  <Cell fill={COLORS.green} />
                  <Cell fill={COLORS.red} />
                </Pie>
                <Tooltip {...chartTooltipStyle} />
                <Legend
                  wrapperStyle={{ background: "transparent" }}
                  formatter={(value) => (
                    <span className="text-xs text-muted-foreground">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
            <p className="text-center text-xs text-muted-foreground -mt-2">
              {stats.passed} passed / {stats.failed} failed
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Domain Performance (Avg Score)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200} style={{ background: "transparent" }}>
              <BarChart data={stats.domainAvgs} layout="vertical" margin={{ left: 0, right: 16 }} style={{ background: "transparent" }}>
                <XAxis type="number" domain={[0, 3]} tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
                <Tooltip {...chartTooltipStyle} cursor={{ fill: "transparent" }} />
                <Bar dataKey="avg" radius={[0, 4, 4, 0]} barSize={18} label={{ position: "right", fontSize: 10, fill: "#a1a1aa", formatter: (v) => Number(v).toFixed(2) }}>
                  {stats.domainAvgs.map((d, i) => (
                    <Cell
                      key={i}
                      fill={d.avg >= 2.5 ? COLORS.green : d.avg >= 1.7 ? COLORS.amber : COLORS.red}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Proficiency Distribution + Score Histogram */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Proficiency Distribution by Domain</CardTitle>
            <CardDescription className="text-xs">Learners at each level per domain</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200} style={{ background: "transparent" }}>
              <BarChart data={stats.domainAvgs} layout="vertical" margin={{ left: 0, right: 16 }} style={{ background: "transparent" }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
                <Tooltip {...chartTooltipStyle} cursor={{ fill: "transparent" }} />
                <Legend
                  wrapperStyle={{ background: "transparent" }}
                  formatter={(value) => (
                    <span className="text-xs text-muted-foreground capitalize">{value}</span>
                  )}
                />
                <Bar dataKey="expert" stackId="a" fill={COLORS.green} barSize={18} radius={[0, 0, 0, 0]} name="Expert" />
                <Bar dataKey="competent" stackId="a" fill={COLORS.amber} barSize={18} name="Competent" />
                <Bar dataKey="novice" stackId="a" fill={COLORS.red} barSize={18} radius={[0, 4, 4, 0]} name="Novice" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Score Distribution</CardTitle>
            <CardDescription className="text-xs">Overall score histogram</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200} style={{ background: "transparent" }}>
              <BarChart data={stats.scoreBuckets} margin={{ left: -10, right: 8 }} style={{ background: "transparent" }}>
                <XAxis dataKey="range" tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip {...chartTooltipStyle} cursor={{ fill: "transparent" }} formatter={(v) => [v, "Learners"]} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={36}>
                  {stats.scoreBuckets.map((b, i) => (
                    <Cell
                      key={i}
                      fill={i >= 2 ? COLORS.green : i === 1 ? COLORS.amber : COLORS.red}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Chart Row 3: Trends */}
      {stats.trends.length > 1 && (
        <Card className="border-border/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pass Rate Over Time</CardTitle>
            <CardDescription className="text-xs">Daily pass rate trend</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200} style={{ background: "transparent" }}>
              <LineChart data={stats.trends} margin={{ left: -10, right: 16 }} style={{ background: "transparent" }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip
                  {...chartTooltipStyle}
                  formatter={(v, name) => [
                    name === "passRate" ? `${v}%` : v,
                    name === "passRate" ? "Pass Rate" : "Attempts",
                  ]}
                />
                <Line type="monotone" dataKey="passRate" stroke={COLORS.green} strokeWidth={2} dot={{ r: 3, fill: COLORS.green }} name="passRate" />
                <Line type="monotone" dataKey="attempts" stroke={COLORS.muted} strokeWidth={1} strokeDasharray="4 4" dot={false} name="attempts" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ResultsPage() {
  const router = useRouter();
  const [summaries, setSummaries] = useState<ResultsSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string>("");
  const [results, setResults] = useState<LearnerResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);

  const loadSummaries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getResultsSummary();
      setSummaries(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummaries();
  }, [loadSummaries]);

  const selectProgram = async (programId: string, name: string) => {
    setSelectedProgram(programId);
    setSelectedName(name);
    setLoadingResults(true);
    try {
      const data = await getProgramResults(programId);
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setLoadingResults(false);
    }
  };

  const goBack = () => {
    setSelectedProgram(null);
    setResults([]);
  };

  return (
    <div className="min-h-screen px-4 py-8 md:px-8 max-w-5xl mx-auto">
      <header className="mb-8">
        <button
          onClick={() =>
            selectedProgram ? goBack() : router.push("/")
          }
          className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 flex items-center gap-1"
        >
          <ArrowLeft className="h-3 w-3" />
          {selectedProgram ? "Back to programs" : "Back to home"}
        </button>
        <h1 className="text-3xl font-bold tracking-tight">
          {selectedProgram ? selectedName : "Results Dashboard"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {selectedProgram
            ? "Review individual learner exam attempts and scores."
            : "Aggregate exam results across all certification programs."}
        </p>
      </header>

      <AnimatePresence mode="wait">
        {/* ── Loading state ── */}
        {loading && !selectedProgram && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center py-20"
          >
            <p className="text-sm text-muted-foreground animate-pulse">
              Loading results...
            </p>
          </motion.div>
        )}

        {/* ── Error state ── */}
        {!loading && error && !selectedProgram && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center gap-4 py-20"
          >
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" onClick={loadSummaries}>
              Retry
            </Button>
          </motion.div>
        )}

        {/* ── Empty state ── */}
        {!loading && !error && summaries.length === 0 && !selectedProgram && (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center gap-6 py-20 text-center"
          >
            <BarChart3 className="h-12 w-12 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                No exam results yet
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Results will appear here once learners complete exams.
              </p>
            </div>
            <Button onClick={() => router.push("/assess")}>
              Take a Test Exam
            </Button>
          </motion.div>
        )}

        {/* ── Program list view ── */}
        {!loading && !error && summaries.length > 0 && !selectedProgram && (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid gap-4 md:grid-cols-2"
          >
            {summaries.map((s, i) => (
              <motion.div
                key={s.program_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i, duration: 0.3 }}
              >
                <Card
                  className="group cursor-pointer border-border/50 transition-all hover:border-rose-500/50 hover:shadow-lg hover:shadow-rose-500/5"
                  onClick={() =>
                    selectProgram(
                      s.program_id,
                      s.program_name || s.program_id
                    )
                  }
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg group-hover:text-rose-400 transition-colors">
                      {s.program_name || s.program_id}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Last attempt{" "}
                      {new Date(s.last_attempt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-6 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        <span className="font-medium text-foreground">
                          {s.total_attempts}
                        </span>{" "}
                        attempts
                      </span>
                      <span className="flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5" />
                        <span className="font-medium text-foreground">
                          {s.avg_score.toFixed(1)}
                        </span>{" "}
                        avg score
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="font-medium text-foreground">
                          {s.passed_count}
                        </span>{" "}
                        passed
                      </span>
                    </div>
                    <PassRateBar
                      passed={s.passed_count}
                      total={s.total_attempts}
                    />
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* ── Program detail / drill-down view ── */}
        {selectedProgram && (
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {/* Stats bar + Export */}
            {!loadingResults && results.length > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>
                    <span className="font-medium text-foreground">
                      {results.length}
                    </span>{" "}
                    total attempts
                  </span>
                  <span>
                    <span className="font-medium text-green-400">
                      {results.filter((r) => r.passed).length}
                    </span>{" "}
                    passed
                  </span>
                  <span>
                    <span className="font-medium text-red-400">
                      {results.filter((r) => !r.passed).length}
                    </span>{" "}
                    failed
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5"
                  onClick={() => exportProgramResults(selectedProgram)}
                >
                  <Download className="h-3.5 w-3.5" />
                  Export CSV
                </Button>
              </div>
            )}

            {loadingResults && (
              <div className="flex items-center justify-center py-16">
                <p className="text-sm text-muted-foreground animate-pulse">
                  Loading learner results...
                </p>
              </div>
            )}

            {!loadingResults && results.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                <BarChart3 className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  No exam attempts recorded for this program yet.
                </p>
              </div>
            )}

            {!loadingResults && results.length > 0 && (
              <div className="space-y-6">
                <ProgramAnalytics results={results} />

                <div>
                  <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
                    Individual Learner Results
                  </h3>
                  <div className="space-y-2">
                    {[...results]
                      .sort((a, b) => a.learner_id.localeCompare(b.learner_id))
                      .map((r, i) => (
                        <LearnerRow key={`${r.thread_id}-${i}`} result={r} index={i} />
                      ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
