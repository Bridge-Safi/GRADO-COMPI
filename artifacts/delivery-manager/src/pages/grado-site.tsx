import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Users, UserCheck, UserPlus, Activity, Diamond, Globe, ExternalLink,
  Search, TrendingUp, Crown, Clock, Zap,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const fetch$ = async <T,>(path: string): Promise<T> => {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

interface ManagementSummary {
  total: number; subscribed: number; close: number;
  active7d: number; active30d: number; newThisWeek: number;
  withDiamonds: number; totalDiamonds: number;
  menuCost: number; totalRevenuePotential: number;
}
interface Member {
  id: string; username: string; rawUsername: string;
  diamonds: number; missing: number; amountMAD: number;
  progressPct: number; sardinesPoints: number; sardinesCount: number;
  periodDiamonds: number; subscriptionStatus: "subscribed" | "close" | "active" | "inactive";
  lastActivity: string; joinedAt: string;
  isNew: boolean; isActive30d: boolean; isActive7d: boolean;
}
interface ManagementData { summary: ManagementSummary; members: Member[] }
interface SignupDay { day: string; count: number }

type FilterType = "all" | "subscribed" | "close" | "active" | "inactive" | "new";

const STATUS_CONFIG = {
  subscribed: { label: "Abonné ✓", color: "text-green-400", bg: "bg-green-500/15 border-green-500/30", dot: "bg-green-400" },
  close:      { label: "Proche",   color: "text-amber-400", bg: "bg-amber-500/15 border-amber-500/30", dot: "bg-amber-400" },
  active:     { label: "Actif",    color: "text-blue-400",  bg: "bg-blue-500/15 border-blue-500/30",   dot: "bg-blue-400" },
  inactive:   { label: "Inactif",  color: "text-zinc-500",  bg: "bg-zinc-800/40 border-zinc-700/30",   dot: "bg-zinc-600" },
};

function KpiCard({ icon, label, value, sub, color, onClick, active }: {
  icon: React.ReactNode; label: string; value: string | number;
  sub?: string; color: string; onClick?: () => void; active?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "glass border rounded-2xl px-5 py-4 flex items-center gap-4 transition-all duration-200",
        onClick && "cursor-pointer hover:scale-[1.02]",
        active ? "border-white/20 ring-1 ring-white/20 bg-white/5" : "border-white/5",
      )}
    >
      <div className={cn("p-2.5 rounded-xl bg-black/40 border border-white/5 shrink-0")}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">{label}</p>
        <p className={cn("text-2xl font-display font-bold leading-none mt-0.5", color)}>{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background/95 border border-white/10 rounded-xl px-3 py-2 shadow-2xl text-xs">
      <p className="font-mono text-muted-foreground">{label}</p>
      <p className="font-bold text-violet-400">{payload[0].value} inscription{payload[0].value !== 1 ? "s" : ""}</p>
    </div>
  );
};

export default function GradoSitePage() {
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const PER_PAGE = 25;

  const { data: mgmt, isLoading } = useQuery<ManagementData>({
    queryKey: ["grado-management"],
    queryFn: () => fetch$("/api/players/management"),
    refetchInterval: 30000,
  });

  const { data: signups } = useQuery<SignupDay[]>({
    queryKey: ["grado-signups-by-day"],
    queryFn: () => fetch$("/api/players/signups-by-day"),
    refetchInterval: 60000,
  });

  const summary = mgmt?.summary;
  const allMembers = mgmt?.members ?? [];

  const filtered = allMembers.filter(m => {
    if (filter === "new" && !m.isNew) return false;
    if (filter === "subscribed" && m.subscriptionStatus !== "subscribed") return false;
    if (filter === "close" && m.subscriptionStatus !== "close") return false;
    if (filter === "active" && m.subscriptionStatus !== "active") return false;
    if (filter === "inactive" && m.subscriptionStatus !== "inactive") return false;
    if (search) {
      const q = search.toLowerCase();
      if (!m.username.toLowerCase().includes(q) && !m.rawUsername.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const paginated = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  const chartData = (signups ?? []).map(r => ({
    day: format(new Date(r.day), "dd/MM", { locale: fr }),
    count: r.count,
  }));

  const toggleFilter = (f: FilterType) => { setFilter(f === filter ? "all" : f); setPage(0); };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl overflow-hidden border border-violet-500/30 shadow-[0_0_20px_rgba(139,92,246,0.25)] shrink-0">
              <img src="/bridge-logo.jpg" alt="Grado" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-4xl font-display font-bold tracking-tight">Grado · Manager</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                Centre de management — <span className="text-violet-400">grado-safi.replit.app</span>
              </p>
            </div>
          </div>
          <a
            href="https://grado-safi.replit.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-violet-500/40 bg-violet-600/20 hover:bg-violet-600/30 transition-all text-violet-300 text-sm font-medium self-start sm:self-auto"
          >
            <Globe className="w-4 h-4" />
            Ouvrir Grado
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
        </div>

        {/* KPIs — cliquables pour filtrer */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            icon={<Users className="w-5 h-5 text-violet-400" />}
            label="Membres inscrits"
            value={summary?.total ?? "—"}
            sub="sur la plateforme"
            color="text-violet-400"
            onClick={() => toggleFilter("all")}
            active={filter === "all"}
          />
          <KpiCard
            icon={<UserPlus className="w-5 h-5 text-green-400" />}
            label="Nouveaux (7j)"
            value={summary?.newThisWeek ?? "—"}
            sub="cette semaine"
            color="text-green-400"
            onClick={() => toggleFilter("new")}
            active={filter === "new"}
          />
          <KpiCard
            icon={<Activity className="w-5 h-5 text-blue-400" />}
            label="Actifs (30j)"
            value={summary?.active30d ?? "—"}
            sub={`${summary?.active7d ?? 0} actifs 7j`}
            color="text-blue-400"
            onClick={() => toggleFilter("active")}
            active={filter === "active"}
          />
          <KpiCard
            icon={<Diamond className="w-5 h-5 text-primary" />}
            label="Ont des diamants"
            value={summary?.withDiamonds ?? "—"}
            sub={`${(summary?.totalDiamonds ?? 0).toLocaleString("fr-MA")} total`}
            color="text-primary"
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Inscriptions chart */}
          <Card className="glass border-white/5 xl:col-span-2">
            <CardHeader className="pb-2 border-b border-white/5">
              <CardTitle className="font-display flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-violet-400" />
                Nouvelles inscriptions par jour
                <Badge variant="outline" className="ml-auto font-mono text-xs">{chartData.length} jours</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {chartData.length === 0 ? (
                <div className="h-44 flex items-center justify-center text-muted-foreground text-sm">Chargement…</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData} margin={{ left: -20, right: 8, top: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="grad-area" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#7C3AED" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="day" tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} interval={2} />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area dataKey="count" stroke="#7C3AED" strokeWidth={2} fill="url(#grad-area)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Répartition statuts */}
          <Card className="glass border-white/5">
            <CardHeader className="pb-2 border-b border-white/5">
              <CardTitle className="font-display flex items-center gap-2 text-base">
                <Zap className="w-4 h-4 text-primary" />
                Statuts abonnement
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {[
                { key: "subscribed" as FilterType, label: "Abonnés ✓", value: summary?.subscribed ?? 0, color: "bg-green-500" },
                { key: "close" as FilterType, label: "Proche (>50% objectif)", value: summary?.close ?? 0, color: "bg-amber-500" },
                { key: "active" as FilterType, label: "Actifs récents", value: summary?.active7d ?? 0, color: "bg-blue-500" },
                { key: "inactive" as FilterType, label: "Inactifs", value: (summary?.total ?? 0) - (summary?.active30d ?? 0), color: "bg-zinc-600" },
              ].map(item => {
                const pct = summary?.total ? Math.round((item.value / summary.total) * 100) : 0;
                return (
                  <button
                    key={item.key}
                    onClick={() => toggleFilter(item.key)}
                    className={cn(
                      "w-full text-left space-y-1 group transition-all",
                      filter === item.key && "opacity-100",
                    )}
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className={cn("text-muted-foreground group-hover:text-foreground transition-colors", filter === item.key && "text-foreground font-medium")}>{item.label}</span>
                      <span className="font-mono font-bold">{item.value} <span className="text-xs text-muted-foreground">({pct}%)</span></span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all duration-700", item.color, filter === item.key && "opacity-100")} style={{ width: `${pct}%` }} />
                    </div>
                  </button>
                );
              })}

              <div className="pt-3 border-t border-white/5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Revenu potentiel total</span>
                  <span className="font-mono font-bold text-primary">{(summary?.totalRevenuePotential ?? 0).toLocaleString("fr-MA")} MAD</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tableau des membres */}
        <Card className="glass border-white/5">
          <CardHeader className="pb-3 border-b border-white/5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <CardTitle className="font-display flex items-center gap-2">
                <Users className="w-5 h-5 text-violet-400" />
                Membres
                <Badge variant="outline" className="font-mono">{filtered.length}</Badge>
              </CardTitle>
              <div className="relative flex-1 max-w-xs ml-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un membre…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(0); }}
                  className="pl-8 h-8 text-sm bg-black/30 border-white/10"
                />
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {(["all", "new", "active", "close", "inactive"] as FilterType[]).map(f => (
                  <button
                    key={f}
                    onClick={() => toggleFilter(f)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all",
                      filter === f
                        ? "border-violet-500/60 bg-violet-600/30 text-violet-300"
                        : "border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20"
                    )}
                  >
                    {f === "all" ? "Tous" : f === "new" ? "Nouveaux" : f === "active" ? "Actifs" : f === "close" ? "Proches" : "Inactifs"}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Chargement des membres…</div>
            ) : (
              <>
                {/* Table header */}
                <div className="grid grid-cols-[2fr_1fr_1.5fr_1fr_1fr] gap-4 px-4 py-2 border-b border-white/5 text-[10px] text-muted-foreground uppercase tracking-widest font-mono">
                  <span>Membre</span>
                  <span>Diamants</span>
                  <span>Progression</span>
                  <span>Abonnement</span>
                  <span>Dernière activité</span>
                </div>

                <div className="divide-y divide-white/5">
                  {paginated.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">Aucun membre trouvé</div>
                  ) : paginated.map(m => {
                    const cfg = STATUS_CONFIG[m.subscriptionStatus];
                    return (
                      <div key={m.id} className="grid grid-cols-[2fr_1fr_1.5fr_1fr_1fr] gap-4 px-4 py-3 hover:bg-white/3 transition-colors items-center">
                        {/* Member */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 border", cfg.bg)}>
                            {m.username.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate">{m.username}</div>
                            {m.isNew && (
                              <span className="text-[10px] text-green-400 font-mono">✦ Nouveau</span>
                            )}
                          </div>
                          {m.diamonds > 0 && <Crown className="w-3 h-3 text-amber-400 shrink-0" />}
                        </div>

                        {/* Diamonds */}
                        <div className="text-sm font-mono">
                          <span className="font-bold text-amber-400">{m.diamonds.toLocaleString()}</span>
                          <span className="text-[10px] text-muted-foreground block">{m.amountMAD} MAD dû</span>
                        </div>

                        {/* Progress */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-mono">
                            <span className="text-muted-foreground">{m.progressPct}%</span>
                            <span className="text-muted-foreground">{m.missing.toLocaleString()} restants</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                m.progressPct >= 100 ? "bg-green-500" :
                                m.progressPct >= 50 ? "bg-amber-500" :
                                m.progressPct > 0 ? "bg-violet-500" : "bg-zinc-700"
                              )}
                              style={{ width: `${Math.max(m.progressPct, m.progressPct > 0 ? 3 : 0)}%` }}
                            />
                          </div>
                        </div>

                        {/* Status */}
                        <div>
                          <span className={cn("text-[11px] px-2 py-0.5 rounded-full border font-medium", cfg.bg, cfg.color)}>
                            {cfg.label}
                          </span>
                        </div>

                        {/* Last activity */}
                        <div className="text-[11px] text-muted-foreground font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3 shrink-0" />
                          {formatDistanceToNow(new Date(m.lastActivity), { addSuffix: true, locale: fr })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
                    <span className="text-xs text-muted-foreground font-mono">
                      {page * PER_PAGE + 1}–{Math.min((page + 1) * PER_PAGE, filtered.length)} / {filtered.length}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="px-3 py-1 rounded-lg border border-white/10 text-xs disabled:opacity-30 hover:bg-white/5 transition-colors"
                      >
                        ← Préc
                      </button>
                      <button
                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={page >= totalPages - 1}
                        className="px-3 py-1 rounded-lg border border-white/10 text-xs disabled:opacity-30 hover:bg-white/5 transition-colors"
                      >
                        Suiv →
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
