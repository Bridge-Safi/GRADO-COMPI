import { useState } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useGetLeaderboard,
  useGetOnlinePlayers,
  useGetPaymentSummary,
  useGetPlayersStats,
  useListPlayers,
  useCreatePlayer,
  useUpdatePlayer,
  useDeletePlayer,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Trophy,
  Diamond,
  Wifi,
  WifiOff,
  Plus,
  Users,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Edit2,
  Loader2,
  Crown,
  Medal,
  Gamepad2,
  Phone,
  Star,
  MapPin,
  UserCheck,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const MENU_COST = 60000;
const RATE = 1000;

function DiamondBadge({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 font-mono font-bold", className)}>
      <Diamond className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
      {value.toLocaleString()}
    </span>
  );
}

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="w-5 h-5 text-yellow-400" />;
  if (rank === 2) return <Medal className="w-5 h-5 text-zinc-300" />;
  if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
  return <span className="text-sm font-mono text-muted-foreground w-5 text-center">#{rank}</span>;
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
      <div
        className={cn(
          "h-full rounded-full transition-all",
          pct >= 100 ? "bg-green-500" : pct >= 70 ? "bg-amber-500" : "bg-primary"
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function PlayerAvatar({ profilePhoto, pseudo, size = "md" }: { profilePhoto?: string | null; pseudo: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-16 h-16 text-xl" };
  if (profilePhoto) {
    return (
      <img
        src={profilePhoto}
        alt={pseudo}
        className={cn(sizes[size], "rounded-full object-cover border border-white/10 shrink-0")}
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  return (
    <div className={cn(sizes[size], "rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center font-bold text-cyan-400 shrink-0")}>
      {pseudo.charAt(0).toUpperCase()}
    </div>
  );
}

type PlayerForm = {
  pseudo: string;
  phone: string;
  email: string;
  address: string;
  profilePhoto: string;
  diamonds: string;
  score: string;
  gamesPlayed: string;
};

const emptyForm: PlayerForm = {
  pseudo: "",
  phone: "",
  email: "",
  address: "",
  profilePhoto: "",
  diamonds: "0",
  score: "0",
  gamesPlayed: "0",
};

export default function SafiRunnerPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<PlayerForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; pseudo: string } | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/players"] });
    queryClient.invalidateQueries({ queryKey: ["/api/players/leaderboard"] });
    queryClient.invalidateQueries({ queryKey: ["/api/players/online"] });
    queryClient.invalidateQueries({ queryKey: ["/api/players/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/players/payment-summary"] });
  };

  const { data: stats } = useGetPlayersStats({ query: { refetchInterval: 8000 } });
  const { data: leaderboard } = useGetLeaderboard({ query: { refetchInterval: 8000 } });
  const { data: online } = useGetOnlinePlayers({ query: { refetchInterval: 5000 } });
  const { data: paymentSummary } = useGetPaymentSummary({ query: { refetchInterval: 8000 } });
  const { data: allPlayers } = useListPlayers({ query: { refetchInterval: 10000 } });

  const { mutate: createPlayer, isPending: isCreating } = useCreatePlayer({
    mutation: {
      onSuccess: () => { toast({ title: "Joueur ajouté !" }); setAddOpen(false); setForm(emptyForm); invalidate(); },
      onError: () => toast({ title: "Erreur lors de l'ajout", variant: "destructive" }),
    },
  });

  const { mutate: updatePlayer, isPending: isUpdating } = useUpdatePlayer({
    mutation: {
      onSuccess: () => { toast({ title: "Joueur mis à jour" }); setEditId(null); invalidate(); },
      onError: () => toast({ title: "Erreur lors de la mise à jour", variant: "destructive" }),
    },
  });

  const { mutate: deletePlayer, isPending: isDeleting } = useDeletePlayer({
    mutation: {
      onSuccess: () => { toast({ title: "Membre supprimé" }); setDeleteTarget(null); invalidate(); },
      onError: () => toast({ title: "Erreur", variant: "destructive" }),
    },
  });

  function handleCreate() {
    createPlayer({
      data: {
        pseudo: form.pseudo,
        phone: form.phone,
        email: form.email || undefined,
        address: form.address || undefined,
        profilePhoto: form.profilePhoto || undefined,
        diamonds: Number(form.diamonds),
        score: Number(form.score),
        gamesPlayed: Number(form.gamesPlayed),
      },
    });
  }

  function startEdit(p: NonNullable<typeof allPlayers>[0]) {
    setEditId(p.id);
    setForm({
      pseudo: p.pseudo,
      phone: p.phone,
      email: p.email ?? "",
      address: p.address ?? "",
      profilePhoto: p.profilePhoto ?? "",
      diamonds: String(p.diamonds),
      score: String(p.score),
      gamesPlayed: String(p.gamesPlayed),
    });
  }

  function handleUpdate() {
    if (editId == null) return;
    updatePlayer({
      id: editId,
      data: {
        pseudo: form.pseudo,
        address: form.address || undefined,
        profilePhoto: form.profilePhoto || undefined,
        diamonds: Number(form.diamonds),
        score: Number(form.score),
        gamesPlayed: Number(form.gamesPlayed),
      },
    });
  }

  const PAYMENT_GROUPS = [
    { key: "ready" as const, label: "Prêts (60 000+ 💎)", color: "text-green-400", border: "border-green-500/20", bg: "bg-green-500/5", icon: <CheckCircle2 className="w-4 h-4 text-green-400" /> },
    { key: "owes10k" as const, label: "Manque ≤ 10 000 💎", color: "text-amber-300", border: "border-amber-500/20", bg: "bg-amber-500/5", icon: <AlertCircle className="w-4 h-4 text-amber-300" /> },
    { key: "owes20k" as const, label: "Manque ≤ 20 000 💎", color: "text-orange-400", border: "border-orange-500/20", bg: "bg-orange-500/5", icon: <AlertCircle className="w-4 h-4 text-orange-400" /> },
    { key: "owes30k" as const, label: "Manque ≤ 30 000 💎", color: "text-red-300", border: "border-red-500/20", bg: "bg-red-500/10", icon: <AlertCircle className="w-4 h-4 text-red-300" /> },
    { key: "owes40k" as const, label: "Manque ≤ 40 000 💎", color: "text-red-400", border: "border-red-500/30", bg: "bg-red-500/10", icon: <AlertCircle className="w-4 h-4 text-red-400" /> },
    { key: "owes50k" as const, label: "Manque ≤ 50 000 💎", color: "text-red-500", border: "border-red-500/40", bg: "bg-red-500/15", icon: <AlertCircle className="w-4 h-4 text-red-500" /> },
    { key: "owesMore" as const, label: "Manque > 50 000 💎", color: "text-zinc-400", border: "border-white/10", bg: "bg-white/5", icon: <AlertCircle className="w-4 h-4 text-zinc-400" /> },
  ];

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-display font-bold tracking-tight flex items-center gap-3">
              <Gamepad2 className="w-9 h-9 text-cyan-400" />
              Safi Runner
            </h1>
            <p className="text-muted-foreground mt-2">Classement, joueurs connectés et gestion des paiements par Diamonds.</p>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-gradient-to-r from-cyan-500 to-primary hover:from-cyan-600 hover:to-primary/90 text-white shadow-lg shadow-cyan-500/20 rounded-xl">
                <Plus className="w-4 h-4" />
                Ajouter un joueur
              </Button>
            </DialogTrigger>
            <DialogContent className="glass border-white/10 max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-display text-xl flex items-center gap-2">
                  <Gamepad2 className="w-5 h-5 text-cyan-400" />
                  Nouveau joueur
                </DialogTitle>
              </DialogHeader>
              <PlayerFormFields form={form} setForm={setForm} />
              <Button
                onClick={handleCreate}
                disabled={isCreating || !form.pseudo || !form.phone}
                className="w-full mt-2 bg-gradient-to-r from-cyan-500 to-primary hover:from-cyan-600 hover:to-primary/90 text-white"
              >
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Créer le joueur
              </Button>
            </DialogContent>
          </Dialog>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard icon={<Users className="w-5 h-5 text-cyan-400" />} label="Total inscrits" value={stats?.total ?? 0} color="text-cyan-400" sub="membres" />
          <KpiCard icon={<Wifi className="w-5 h-5 text-green-400" />} label="En ligne" value={stats?.online ?? 0} color="text-green-400" sub="connectés" />
          <KpiCard icon={<CheckCircle2 className="w-5 h-5 text-green-500" />} label="Menu payé" value={stats?.ready ?? 0} color="text-green-500" sub="60 000+ 💎" />
          <KpiCard icon={<AlertCircle className="w-5 h-5 text-amber-400" />} label="En attente" value={stats?.notReady ?? 0} color="text-amber-400" sub="doivent payer" />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="members" className="space-y-6">
          <TabsList className="bg-black/40 border border-white/10 rounded-2xl p-1 flex flex-wrap gap-1">
            <TabsTrigger value="members" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500/20 data-[state=active]:to-primary/20 data-[state=active]:text-white">
              <UserCheck className="w-4 h-4 mr-2" />
              Membres inscrits
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500/20 data-[state=active]:to-primary/20 data-[state=active]:text-white">
              <Trophy className="w-4 h-4 mr-2" />
              Classement
            </TabsTrigger>
            <TabsTrigger value="online" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500/20 data-[state=active]:to-cyan-500/20 data-[state=active]:text-white">
              <Wifi className="w-4 h-4 mr-2" />
              En ligne
            </TabsTrigger>
            <TabsTrigger value="payment" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/20 data-[state=active]:to-amber-500/20 data-[state=active]:text-white">
              <CreditCard className="w-4 h-4 mr-2" />
              Paiements
            </TabsTrigger>
            <TabsTrigger value="manage" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/20 data-[state=active]:to-amber-500/20 data-[state=active]:text-white">
              <Edit2 className="w-4 h-4 mr-2" />
              Gérer
            </TabsTrigger>
          </TabsList>

          {/* ── MEMBRES INSCRITS ── */}
          <TabsContent value="members">
            <Card className="glass border-white/5">
              <CardHeader className="p-5 pb-3 border-b border-white/5 flex flex-row items-center justify-between">
                <CardTitle className="font-display flex items-center gap-2 text-xl">
                  <UserCheck className="w-5 h-5 text-cyan-400" />
                  Membres inscrits sur Bridge Eats
                </CardTitle>
                <Badge variant="outline" className="font-mono">{allPlayers?.length ?? 0} membres</Badge>
              </CardHeader>
              <CardContent className="p-0">
                {!allPlayers || allPlayers.length === 0 ? (
                  <EmptyState icon={<Users />} text="Aucun membre inscrit pour le moment." />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 p-5">
                    {allPlayers.map((player) => (
                      <div
                        key={player.id}
                        className="relative group rounded-2xl border border-white/10 bg-black/30 p-4 flex flex-col gap-3 hover:border-cyan-500/30 hover:bg-black/50 transition-all"
                      >
                        {/* Delete button */}
                        <button
                          onClick={() => setDeleteTarget({ id: player.id, pseudo: player.pseudo })}
                          className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-red-500/0 hover:bg-red-500/20 border border-transparent hover:border-red-500/30 flex items-center justify-center text-muted-foreground hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Top: Avatar + Name + Status */}
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            <PlayerAvatar profilePhoto={player.profilePhoto} pseudo={player.pseudo} size="lg" />
                            {player.isOnline && (
                              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-background animate-pulse" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-display font-bold text-base truncate">{player.pseudo}</div>
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono mt-0.5">
                              <Phone className="w-3 h-3 shrink-0" />
                              <span className="truncate">{player.phone}</span>
                            </div>
                            {player.address && (
                              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono mt-0.5">
                                <MapPin className="w-3 h-3 shrink-0 text-amber-400" />
                                <span className="truncate">{player.address}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Diamonds progress */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <DiamondBadge value={player.diamonds} className="text-sm" />
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {Math.min(100, Math.round((player.diamonds / MENU_COST) * 100))}% du menu
                            </span>
                          </div>
                          <ProgressBar value={player.diamonds} max={MENU_COST} />
                        </div>

                        {/* Footer: games + inscription date + status */}
                        <div className="flex items-center justify-between pt-1 border-t border-white/5">
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
                            <span className="flex items-center gap-1">
                              <Gamepad2 className="w-3 h-3" />
                              {player.gamesPlayed} parties
                            </span>
                            <span className="flex items-center gap-1">
                              <Star className="w-3 h-3 text-yellow-500" />
                              {player.score.toLocaleString()} pts
                            </span>
                          </div>
                          <StatusPayBadge missing={player.missing} />
                        </div>

                        {/* Inscription date */}
                        <div className="text-[10px] text-muted-foreground font-mono">
                          Inscrit {formatDistanceToNow(new Date(player.createdAt), { addSuffix: true, locale: fr })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── LEADERBOARD ── */}
          <TabsContent value="leaderboard">
            <Card className="glass border-white/5">
              <CardHeader className="p-5 pb-3 border-b border-white/5 flex flex-row items-center justify-between">
                <CardTitle className="font-display flex items-center gap-2 text-xl">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  Top Joueurs — J'le Requin
                </CardTitle>
                <Badge variant="outline" className="font-mono">{leaderboard?.length ?? 0} joueurs</Badge>
              </CardHeader>
              <CardContent className="p-0">
                {!leaderboard || leaderboard.length === 0 ? (
                  <EmptyState icon={<Trophy />} text="Aucun joueur classé pour le moment." />
                ) : (
                  <div className="divide-y divide-white/5">
                    {leaderboard.map((player) => (
                      <div
                        key={player.id}
                        className={cn(
                          "flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-white/5",
                          player.rank <= 3 ? "bg-white/[0.02]" : ""
                        )}
                      >
                        <div className="w-8 flex justify-center shrink-0">
                          <RankIcon rank={player.rank} />
                        </div>
                        <div className="relative shrink-0">
                          <PlayerAvatar profilePhoto={player.profilePhoto} pseudo={player.pseudo} size="sm" />
                          {player.isOnline && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-background animate-pulse" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-display font-bold text-sm truncate">{player.pseudo}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <ProgressBar value={player.diamonds} max={MENU_COST} />
                            <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap shrink-0">
                              {Math.min(100, Math.round((player.diamonds / MENU_COST) * 100))}%
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0 space-y-0.5">
                          <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground font-mono">
                            <Star className="w-3 h-3 text-yellow-500" />
                            {player.score.toLocaleString()} pts
                          </div>
                          <DiamondBadge value={player.diamonds} className="text-sm" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── EN LIGNE ── */}
          <TabsContent value="online">
            <Card className="glass border-white/5">
              <CardHeader className="p-5 pb-3 border-b border-white/5 flex flex-row items-center justify-between">
                <CardTitle className="font-display flex items-center gap-2 text-xl">
                  <Wifi className="w-5 h-5 text-green-400" />
                  Joueurs connectés
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <Badge variant="outline" className="font-mono text-green-400 border-green-500/30">
                    {online?.length ?? 0} en ligne
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {!online || online.length === 0 ? (
                  <EmptyState icon={<WifiOff />} text="Aucun joueur connecté en ce moment." />
                ) : (
                  <ScrollArea className="h-[500px]">
                    <div className="divide-y divide-white/5">
                      {online.map((player) => (
                        <div key={player.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/5 transition-colors">
                          <div className="relative shrink-0">
                            <PlayerAvatar profilePhoto={player.profilePhoto} pseudo={player.pseudo} size="sm" />
                            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-background animate-pulse" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-display font-bold text-sm">{player.pseudo}</div>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground font-mono">
                              <Phone className="w-3 h-3" />
                              {player.phone}
                              {player.lastSeenAt && (
                                <span className="text-green-500">
                                  · vu {formatDistanceToNow(new Date(player.lastSeenAt), { addSuffix: true, locale: fr })}
                                </span>
                              )}
                            </div>
                            {player.address && (
                              <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono mt-0.5">
                                <MapPin className="w-2.5 h-2.5 text-amber-400" />
                                {player.address}
                              </div>
                            )}
                          </div>
                          <div className="text-right shrink-0 space-y-1">
                            <DiamondBadge value={player.diamonds} className="text-sm" />
                            <div className="text-[10px] text-muted-foreground font-mono">
                              <Star className="w-2.5 h-2.5 inline text-yellow-500 mr-0.5" />
                              {player.score.toLocaleString()} pts
                            </div>
                          </div>
                          <StatusPayBadge missing={player.missing} />
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── PAIEMENTS ── */}
          <TabsContent value="payment">
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="glass border-green-500/20 bg-green-500/5">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-display font-bold text-green-400">{paymentSummary?.ready.length ?? 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">Prêts à commander</p>
                  </CardContent>
                </Card>
                <Card className="glass border-amber-500/20 bg-amber-500/5">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-display font-bold text-amber-400">
                      {((paymentSummary?.owes10k.length ?? 0) + (paymentSummary?.owes20k.length ?? 0))}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Manque ≤ 20 000 💎</p>
                  </CardContent>
                </Card>
                <Card className="glass border-red-500/20 bg-red-500/5">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-display font-bold text-red-400">
                      {((paymentSummary?.owes30k.length ?? 0) + (paymentSummary?.owes40k.length ?? 0) + (paymentSummary?.owes50k.length ?? 0))}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Manque 20k–50k 💎</p>
                  </CardContent>
                </Card>
                <Card className="glass border-white/10 bg-white/5">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-display font-bold text-zinc-400">{paymentSummary?.owesMore.length ?? 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">Manque &gt; 50 000 💎</p>
                  </CardContent>
                </Card>
              </div>

              {PAYMENT_GROUPS.map((group) => {
                const players = paymentSummary?.[group.key] ?? [];
                if (players.length === 0) return null;
                return (
                  <Card key={group.key} className={cn("glass border", group.border, group.bg)}>
                    <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                      <CardTitle className={cn("font-display text-base flex items-center gap-2", group.color)}>
                        {group.icon}
                        {group.label}
                      </CardTitle>
                      <Badge variant="outline" className={cn("font-mono text-xs", group.border, group.color)}>
                        {players.length} joueur{players.length > 1 ? "s" : ""}
                      </Badge>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="divide-y divide-white/5">
                        {players.map((p) => (
                          <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors">
                            <PlayerAvatar profilePhoto={p.profilePhoto} pseudo={p.pseudo} size="sm" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm flex items-center gap-2">
                                {p.pseudo}
                                {p.isOnline && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
                              </div>
                              <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                                <Phone className="w-2.5 h-2.5" /> {p.phone}
                              </div>
                            </div>
                            <div className="text-right space-y-1 shrink-0">
                              <DiamondBadge value={p.diamonds} className="text-xs" />
                              {p.missing > 0 && (
                                <div className="text-[11px] font-mono text-red-400">
                                  −{p.missing.toLocaleString()} 💎
                                </div>
                              )}
                            </div>
                            {p.missing > 0 ? (
                              <div className="text-right shrink-0 min-w-[72px]">
                                <div className="text-sm font-mono font-bold text-amber-400">
                                  {p.amountMAD} MAD
                                </div>
                                <div className="text-[10px] text-muted-foreground">à payer</div>
                              </div>
                            ) : (
                              <div className="text-right shrink-0 min-w-[72px]">
                                <div className="text-sm font-mono font-bold text-green-400">0 MAD</div>
                                <div className="text-[10px] text-green-500">✓ menu offert</div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {paymentSummary?.totalPlayers === 0 && (
                <EmptyState icon={<CreditCard />} text="Aucun joueur enregistré." />
              )}
            </div>
          </TabsContent>

          {/* ── GÉRER ── */}
          <TabsContent value="manage">
            <Card className="glass border-white/5">
              <CardHeader className="p-5 pb-3 border-b border-white/5">
                <CardTitle className="font-display flex items-center gap-2 text-xl">
                  <Users className="w-5 h-5 text-primary" />
                  Tous les joueurs
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!allPlayers || allPlayers.length === 0 ? (
                  <EmptyState icon={<Users />} text="Aucun joueur. Cliquez sur Ajouter." />
                ) : (
                  <ScrollArea className="h-[600px]">
                    <div className="divide-y divide-white/5">
                      {allPlayers.map((player) => (
                        <div key={player.id}>
                          {editId === player.id ? (
                            <div className="p-5 space-y-3 bg-white/5">
                              <div className="flex justify-between items-center">
                                <span className="font-display font-bold text-sm">Modifier {player.pseudo}</span>
                                <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>Annuler</Button>
                              </div>
                              <PlayerFormFields form={form} setForm={setForm} editMode />
                              <Button
                                onClick={handleUpdate}
                                disabled={isUpdating}
                                size="sm"
                                className="w-full bg-gradient-to-r from-cyan-500 to-primary text-white"
                              >
                                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                Enregistrer
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/5 transition-colors">
                              <PlayerAvatar profilePhoto={player.profilePhoto} pseudo={player.pseudo} size="sm" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm truncate">{player.pseudo}</span>
                                  {player.isOnline && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />}
                                </div>
                                <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono mt-0.5 flex-wrap">
                                  <span><Phone className="w-2.5 h-2.5 inline mr-0.5" />{player.phone}</span>
                                  {player.address && <span><MapPin className="w-2.5 h-2.5 inline mr-0.5 text-amber-400" />{player.address}</span>}
                                  <span><Gamepad2 className="w-2.5 h-2.5 inline mr-0.5" />{player.gamesPlayed} parties</span>
                                </div>
                              </div>
                              <div className="text-right shrink-0 space-y-0.5">
                                <DiamondBadge value={player.diamonds} className="text-sm" />
                                <div className="text-[10px] text-muted-foreground font-mono">
                                  <Star className="w-2.5 h-2.5 inline text-yellow-500 mr-0.5" />
                                  {player.score.toLocaleString()} pts
                                </div>
                              </div>
                              <StatusPayBadge missing={player.missing} />
                              <div className="flex gap-1 shrink-0">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="w-7 h-7 text-muted-foreground hover:text-foreground"
                                  onClick={() => startEdit(player)}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="w-7 h-7 text-muted-foreground hover:text-red-400"
                                  onClick={() => setDeleteTarget({ id: player.id, pseudo: player.pseudo })}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="glass border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-400" />
              Supprimer ce membre ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tu vas supprimer définitivement <span className="font-bold text-white">{deleteTarget?.pseudo}</span> de Bridge Eats. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deletePlayer({ id: deleteTarget.id })}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}

function StatusPayBadge({ missing }: { missing: number }) {
  if (missing === 0) {
    return (
      <Badge variant="outline" className="border-green-500/30 text-green-400 bg-green-500/5 text-[10px] font-mono shrink-0">
        ✓ Prêt
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-amber-500/30 text-amber-400 bg-amber-500/5 text-[10px] font-mono shrink-0 whitespace-nowrap">
      -{missing.toLocaleString()} 💎
    </Badge>
  );
}

function KpiCard({ icon, label, value, color, sub }: {
  icon: React.ReactNode; label: string; value: number; color: string; sub: string;
}) {
  return (
    <Card className="glass border-white/5">
      <CardContent className="p-5 flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 shrink-0">{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono truncate">{label}</p>
          <p className={cn("text-3xl font-display font-bold leading-none mt-1", color)}>{value}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground">
        {icon}
      </div>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function PlayerFormFields({
  form,
  setForm,
  editMode = false,
}: {
  form: PlayerForm;
  setForm: React.Dispatch<React.SetStateAction<PlayerForm>>;
  editMode?: boolean;
}) {
  const field = (key: keyof PlayerForm) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground uppercase tracking-widest">Pseudo *</Label>
        <Input placeholder="LeRequin" className="bg-black/30 border-white/10" {...field("pseudo")} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground uppercase tracking-widest">Téléphone *</Label>
        <Input placeholder="+212 6XX..." className="bg-black/30 border-white/10" disabled={editMode} {...field("phone")} />
      </div>
      {!editMode && (
        <div className="col-span-2 space-y-1">
          <Label className="text-xs text-muted-foreground uppercase tracking-widest">Email</Label>
          <Input placeholder="email@example.com" className="bg-black/30 border-white/10" {...field("email")} />
        </div>
      )}
      <div className="col-span-2 space-y-1">
        <Label className="text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-1">
          <MapPin className="w-3 h-3 text-amber-400" /> Adresse
        </Label>
        <Input placeholder="Rue, Ville..." className="bg-black/30 border-white/10" {...field("address")} />
      </div>
      <div className="col-span-2 space-y-1">
        <Label className="text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-1">
          <ImageIcon className="w-3 h-3 text-cyan-400" /> Photo de profil (URL)
        </Label>
        <Input placeholder="https://..." className="bg-black/30 border-white/10" {...field("profilePhoto")} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-1">
          <Diamond className="w-3 h-3 text-cyan-400" /> Diamonds
        </Label>
        <Input type="number" min={0} className="bg-black/30 border-white/10" {...field("diamonds")} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-1">
          <Star className="w-3 h-3 text-yellow-400" /> Score
        </Label>
        <Input type="number" min={0} className="bg-black/30 border-white/10" {...field("score")} />
      </div>
      <div className="col-span-2 space-y-1">
        <Label className="text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-1">
          <Gamepad2 className="w-3 h-3" /> Parties jouées
        </Label>
        <Input type="number" min={0} className="bg-black/30 border-white/10" {...field("gamesPlayed")} />
      </div>
    </div>
  );
}
