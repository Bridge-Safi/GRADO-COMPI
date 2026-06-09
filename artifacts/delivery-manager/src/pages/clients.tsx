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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useListClients,
  useGetClientsFromOrders,
  useGetClientsStats,
  useCreateClient,
  useUpdateClient,
  useDeleteClient,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Users,
  Plus,
  Phone,
  MapPin,
  Star,
  ShoppingBag,
  Trash2,
  Edit2,
  Loader2,
  Crown,
  TrendingUp,
  UserCircle,
  FileText,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type ClientForm = {
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  isVip: boolean;
};

const emptyForm: ClientForm = { name: "", phone: "", email: "", address: "", notes: "", isVip: false };

export default function ClientsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<{ id: number; form: ClientForm } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [search, setSearch] = useState("");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    queryClient.invalidateQueries({ queryKey: ["/api/clients/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/clients/from-orders"] });
  };

  const { data: stats } = useGetClientsStats({ query: { refetchInterval: 10000 } });
  const { data: clients } = useListClients({ query: { refetchInterval: 10000 } });
  const { data: fromOrders } = useGetClientsFromOrders({ query: { refetchInterval: 15000 } });

  const { mutate: createClient, isPending: isCreating } = useCreateClient({
    mutation: {
      onSuccess: () => { toast({ title: "Client ajouté !" }); setAddOpen(false); setForm(emptyForm); invalidate(); },
      onError: () => toast({ title: "Erreur lors de l'ajout", variant: "destructive" }),
    },
  });

  const { mutate: updateClient, isPending: isUpdating } = useUpdateClient({
    mutation: {
      onSuccess: () => { toast({ title: "Client mis à jour" }); setEditTarget(null); invalidate(); },
      onError: () => toast({ title: "Erreur", variant: "destructive" }),
    },
  });

  const { mutate: deleteClient, isPending: isDeleting } = useDeleteClient({
    mutation: {
      onSuccess: () => { toast({ title: "Client supprimé" }); setDeleteTarget(null); invalidate(); },
      onError: () => toast({ title: "Erreur", variant: "destructive" }),
    },
  });

  const filtered = (clients ?? []).filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      (c.address ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const filteredFromOrders = (fromOrders ?? []).filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  );

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-display font-bold tracking-tight flex items-center gap-3">
              <Users className="w-9 h-9 text-primary" />
              Clients
            </h1>
            <p className="text-muted-foreground mt-2">Base de données clients — historique, commandes et fidélité.</p>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-gradient-to-r from-primary to-amber-500 hover:opacity-90 text-white shadow-lg shadow-primary/20 rounded-xl">
                <Plus className="w-4 h-4" />
                Ajouter un client
              </Button>
            </DialogTrigger>
            <DialogContent className="glass border-white/10 max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-display text-xl flex items-center gap-2">
                  <UserCircle className="w-5 h-5 text-primary" />
                  Nouveau client
                </DialogTitle>
              </DialogHeader>
              <ClientFormFields form={form} setForm={setForm} />
              <Button
                onClick={() => createClient({ data: { name: form.name, phone: form.phone, email: form.email || undefined, address: form.address || undefined, notes: form.notes || undefined, isVip: form.isVip } })}
                disabled={isCreating || !form.name || !form.phone}
                className="w-full mt-2 bg-gradient-to-r from-primary to-amber-500 text-white"
              >
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Créer le client
              </Button>
            </DialogContent>
          </Dialog>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard icon={<Users className="w-5 h-5 text-primary" />} label="Clients enregistrés" value={stats?.total ?? 0} color="text-primary" sub="dans la base" />
          <KpiCard icon={<Crown className="w-5 h-5 text-yellow-400" />} label="Clients VIP" value={stats?.vip ?? 0} color="text-yellow-400" sub="fidèles" />
          <KpiCard icon={<ShoppingBag className="w-5 h-5 text-cyan-400" />} label="Clients uniques" value={stats?.uniqueCustomers ?? 0} color="text-cyan-400" sub="ont commandé" />
          <KpiCard icon={<TrendingUp className="w-5 h-5 text-green-400" />} label="Revenu total" value={stats?.totalRevenue ?? 0} color="text-green-400" sub="MAD cumulés" isMoney />
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, téléphone, adresse..."
            className="pl-9 bg-black/30 border-white/10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="registered" className="space-y-6">
          <TabsList className="bg-black/40 border border-white/10 rounded-2xl p-1">
            <TabsTrigger value="registered" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/20 data-[state=active]:to-amber-500/20 data-[state=active]:text-white">
              <UserCircle className="w-4 h-4 mr-2" />
              Enregistrés ({filtered.length})
            </TabsTrigger>
            <TabsTrigger value="from-orders" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500/20 data-[state=active]:to-primary/20 data-[state=active]:text-white">
              <ShoppingBag className="w-4 h-4 mr-2" />
              Depuis commandes ({filteredFromOrders.length})
            </TabsTrigger>
          </TabsList>

          {/* ── ENREGISTRÉS ── */}
          <TabsContent value="registered">
            <Card className="glass border-white/5">
              <CardHeader className="p-5 pb-3 border-b border-white/5 flex flex-row items-center justify-between">
                <CardTitle className="font-display flex items-center gap-2 text-xl">
                  <Users className="w-5 h-5 text-primary" />
                  Clients enregistrés manuellement
                </CardTitle>
                <Badge variant="outline" className="font-mono">{filtered.length} clients</Badge>
              </CardHeader>
              <CardContent className="p-0">
                {filtered.length === 0 ? (
                  <EmptyState icon={<Users />} text="Aucun client enregistré. Cliquez sur Ajouter." />
                ) : (
                  <ScrollArea className="h-[600px]">
                    <div className="divide-y divide-white/5">
                      {filtered.map((client) => (
                        <div key={client.id}>
                          {editTarget?.id === client.id ? (
                            <div className="p-5 space-y-3 bg-white/5">
                              <div className="flex justify-between items-center">
                                <span className="font-display font-bold text-sm">Modifier {client.name}</span>
                                <Button size="sm" variant="ghost" onClick={() => setEditTarget(null)}>Annuler</Button>
                              </div>
                              <ClientFormFields form={editTarget.form} setForm={(f) => setEditTarget((prev) => prev ? { ...prev, form: typeof f === "function" ? f(prev.form) : f } : null)} />
                              <Button
                                onClick={() => updateClient({ id: client.id, data: { name: editTarget.form.name, email: editTarget.form.email || undefined, address: editTarget.form.address || undefined, notes: editTarget.form.notes || undefined, isVip: editTarget.form.isVip } })}
                                disabled={isUpdating}
                                size="sm"
                                className="w-full bg-gradient-to-r from-primary to-amber-500 text-white"
                              >
                                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                Enregistrer
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/5 transition-colors group">
                              {/* Avatar */}
                              <div className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border",
                                client.isVip
                                  ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-300"
                                  : "bg-primary/10 border-primary/20 text-primary"
                              )}>
                                {client.isVip ? <Crown className="w-4 h-4" /> : client.name.charAt(0).toUpperCase()}
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-display font-bold text-sm truncate">{client.name}</span>
                                  {client.isVip && (
                                    <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30 text-[10px] font-mono">VIP</Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono mt-0.5 flex-wrap">
                                  <a href={`tel:${client.phone}`} className="flex items-center gap-1 hover:text-white transition-colors"><Phone className="w-2.5 h-2.5 text-green-400" />{client.phone}</a>
                                  {client.email && <a href={`mailto:${client.email}`} className="flex items-center gap-1 hover:text-amber-300 transition-colors text-amber-400/80">✉ {client.email}</a>}
                                  {client.address && <span className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5 text-amber-400" />{client.address}</span>}
                                </div>
                                {client.notes && (
                                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                                    <FileText className="w-2.5 h-2.5" />{client.notes}
                                  </div>
                                )}
                              </div>

                              {/* Stats */}
                              <div className="text-right shrink-0 space-y-0.5">
                                <div className="flex items-center justify-end gap-1 text-sm font-mono font-bold text-primary">
                                  <ShoppingBag className="w-3.5 h-3.5" />
                                  {client.totalOrders} cmd
                                </div>
                                <div className="text-xs font-mono text-green-400">{client.totalSpent.toFixed(0)} MAD</div>
                                {client.lastOrderAt && (
                                  <div className="text-[10px] text-muted-foreground">
                                    {formatDistanceToNow(new Date(client.lastOrderAt), { addSuffix: true, locale: fr })}
                                  </div>
                                )}
                              </div>

                              {/* Actions */}
                              <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  size="icon" variant="ghost"
                                  className="w-7 h-7 text-muted-foreground hover:text-foreground"
                                  onClick={() => setEditTarget({ id: client.id, form: { name: client.name, phone: client.phone, email: client.email ?? "", address: client.address ?? "", notes: client.notes ?? "", isVip: client.isVip } })}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="icon" variant="ghost"
                                  className="w-7 h-7 text-muted-foreground hover:text-red-400"
                                  onClick={() => setDeleteTarget({ id: client.id, name: client.name })}
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

          {/* ── DEPUIS COMMANDES ── */}
          <TabsContent value="from-orders">
            <Card className="glass border-white/5">
              <CardHeader className="p-5 pb-3 border-b border-white/5 flex flex-row items-center justify-between">
                <CardTitle className="font-display flex items-center gap-2 text-xl">
                  <ShoppingBag className="w-5 h-5 text-cyan-400" />
                  Clients détectés automatiquement
                </CardTitle>
                <Badge variant="outline" className="font-mono text-cyan-400 border-cyan-500/30">{filteredFromOrders.length} clients</Badge>
              </CardHeader>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Ces clients sont extraits automatiquement depuis l'historique des commandes. Tu peux les enregistrer manuellement pour leur ajouter des infos supplémentaires.
                </p>
                {filteredFromOrders.length === 0 ? (
                  <EmptyState icon={<ShoppingBag />} text="Aucune commande enregistrée pour le moment." />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {filteredFromOrders.map((c) => (
                      <div key={c.phone} className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-2 hover:border-cyan-500/30 transition-all">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center font-bold text-cyan-400 text-sm shrink-0">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-display font-bold text-sm truncate">{c.name}</div>
                            <a href={`tel:${c.phone}`} className="text-[11px] text-muted-foreground font-mono flex items-center gap-1 hover:text-green-400 transition-colors">
                              <Phone className="w-2.5 h-2.5 text-green-400" />{c.phone}
                            </a>
                          </div>
                        </div>
                        {c.address && (
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-2.5 h-2.5 text-amber-400" />
                            <span className="truncate">{c.address}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-1 border-t border-white/5">
                          <div className="flex items-center gap-1 text-[11px] font-mono text-cyan-400">
                            <ShoppingBag className="w-3 h-3" />
                            {c.totalOrders} commande{c.totalOrders > 1 ? "s" : ""}
                          </div>
                          <div className="text-[11px] font-mono text-green-400 font-bold">{c.totalSpent.toFixed(0)} MAD</div>
                        </div>
                        {c.lastOrderAt && (
                          <div className="text-[10px] text-muted-foreground">
                            Dernière commande {formatDistanceToNow(new Date(c.lastOrderAt), { addSuffix: true, locale: fr })}
                          </div>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full border-white/10 text-[11px] h-7 hover:bg-primary/10 hover:border-primary/30 hover:text-primary"
                          onClick={() => {
                            setForm({ name: c.name, phone: c.phone, email: "", address: c.address, notes: "", isVip: false });
                            setAddOpen(true);
                          }}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Enregistrer ce client
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="glass border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-400" />
              Supprimer ce client ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Supprimer définitivement <span className="font-bold text-white">{deleteTarget?.name}</span> ? Ses commandes ne seront pas supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteClient({ id: deleteTarget.id })}
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

function KpiCard({ icon, label, value, color, sub, isMoney }: {
  icon: React.ReactNode; label: string; value: number; color: string; sub: string; isMoney?: boolean;
}) {
  return (
    <Card className="glass border-white/5">
      <CardContent className="p-5 flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 shrink-0">{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono truncate">{label}</p>
          <p className={cn("text-2xl font-display font-bold leading-none mt-1", color)}>
            {isMoney ? `${value.toFixed(0)}` : value}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground">{icon}</div>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function ClientFormFields({ form, setForm }: {
  form: ClientForm;
  setForm: React.Dispatch<React.SetStateAction<ClientForm>>;
}) {
  const field = (key: keyof ClientForm) => ({
    value: String(form[key]),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground uppercase tracking-widest">Nom *</Label>
        <Input placeholder="Mohamed Ali" className="bg-black/30 border-white/10" {...field("name")} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground uppercase tracking-widest">Téléphone *</Label>
        <Input placeholder="+212 6XX..." className="bg-black/30 border-white/10" {...field("phone")} />
      </div>
      <div className="col-span-2 space-y-1">
        <Label className="text-xs text-muted-foreground uppercase tracking-widest">Email</Label>
        <Input placeholder="email@example.com" className="bg-black/30 border-white/10" {...field("email")} />
      </div>
      <div className="col-span-2 space-y-1">
        <Label className="text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-1">
          <MapPin className="w-3 h-3 text-amber-400" /> Adresse
        </Label>
        <Input placeholder="Rue, Ville..." className="bg-black/30 border-white/10" {...field("address")} />
      </div>
      <div className="col-span-2 space-y-1">
        <Label className="text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-1">
          <FileText className="w-3 h-3" /> Notes
        </Label>
        <Input placeholder="Allergies, préférences..." className="bg-black/30 border-white/10" {...field("notes")} />
      </div>
      <div className="col-span-2 flex items-center gap-3 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
        <input
          type="checkbox"
          id="isVip"
          checked={form.isVip}
          onChange={(e) => setForm((f) => ({ ...f, isVip: e.target.checked }))}
          className="w-4 h-4 accent-yellow-500"
        />
        <label htmlFor="isVip" className="flex items-center gap-2 text-sm cursor-pointer">
          <Crown className="w-4 h-4 text-yellow-400" />
          <span className="font-medium text-yellow-300">Client VIP</span>
          <span className="text-xs text-muted-foreground">— priorité de livraison</span>
        </label>
      </div>
    </div>
  );
}
