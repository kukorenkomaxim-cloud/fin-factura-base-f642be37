import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocale } from "@/hooks/use-locale";
import {
  adminListUsers,
  adminListCodes,
  adminGenerateCodes,
  adminGrantSubscription,
  adminRevokeSubscription,
  adminVisitorStats,
  type AdminUserRow,
} from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Copy, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_app/admin")({
  component: AdminPage,
});

const LOCALES: Record<string, string> = { ru: "ru-RU", en: "en-US", es: "es-ES", uk: "uk-UA" };

function AdminPage() {
  const { t } = useLocale();
  return (
    <div>
      <h1 className="text-2xl font-bold">{t.adminTitle}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t.adminSubtitle}</p>
      <Tabs defaultValue="users" className="mt-6">
        <TabsList>
          <TabsTrigger value="users">{t.adminTabUsers}</TabsTrigger>
          <TabsTrigger value="visitors">{t.adminTabVisitors}</TabsTrigger>
          <TabsTrigger value="codes">{t.adminTabCodes}</TabsTrigger>
        </TabsList>
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
        <TabsContent value="visitors">
          <VisitorsTab />
        </TabsContent>
        <TabsContent value="codes">
          <CodesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function fmtDate(lang: string, v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString(LOCALES[lang] ?? "en-US");
}

function VisitorsTab() {
  const { t } = useLocale();
  const [periodDays, setPeriodDays] = useState(30);
  const [pendingPeriod, setPendingPeriod] = useState("30");

  const fetchStats = useServerFn(adminVisitorStats);
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["admin-visitors", periodDays],
    queryFn: () => fetchStats({ data: { periodDays } }),
  });

  function applyPeriod() {
    const n = parseInt(pendingPeriod, 10);
    if (Number.isFinite(n) && n > 0) setPeriodDays(n);
  }

  if (isError) {
    return <p className="mt-6 text-sm text-destructive">{t.adminAccessDenied}</p>;
  }

  const stats = [
    { label: t.visitorsTotalVisits, value: data?.totalVisits },
    { label: t.visitorsUnique, value: data?.uniqueVisitors },
    { label: t.visitorsReturning, value: data?.returningVisitors, hint: t.visitorsReturningHint },
    { label: t.visitorsNew, value: data?.newVisitors },
  ];

  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm text-muted-foreground">{t.visitorsDescription}</p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="visitor-period" className="text-xs">{t.adminPeriodLabel}</Label>
          <Input
            id="visitor-period"
            type="number"
            min={1}
            className="h-9 w-40"
            value={pendingPeriod}
            onChange={(e) => setPendingPeriod(e.target.value)}
            onBlur={applyPeriod}
            onKeyDown={(e) => e.key === "Enter" && applyPeriod()}
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-1.5 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          {t.adminRefresh}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-2 text-2xl font-bold tabular-nums">
              {isLoading ? "…" : (s.value ?? 0).toLocaleString()}
            </p>
            {s.hint && <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>}
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">{t.visitorsNote}</p>
    </div>
  );
}

function UsersTab() {
  const { t, lang } = useLocale();
  const qc = useQueryClient();
  const [periodDays, setPeriodDays] = useState(30);
  const [pendingPeriod, setPendingPeriod] = useState("30");

  const fetchUsers = useServerFn(adminListUsers);
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["admin-users", periodDays],
    queryFn: () => fetchUsers({ data: { periodDays } }),
  });

  const grant = useServerFn(adminGrantSubscription);
  const revoke = useServerFn(adminRevokeSubscription);

  const grantMut = useMutation({
    mutationFn: (v: { userId: string; durationDays: number; plan: string }) => grant({ data: v }),
    onSuccess: () => {
      toast.success(t.adminGranted);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e) => toast.error(t.adminError, { description: String(e) }),
  });
  const revokeMut = useMutation({
    mutationFn: (userId: string) => revoke({ data: { userId } }),
    onSuccess: () => {
      toast.success(t.adminRevoked);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e) => toast.error(t.adminError, { description: String(e) }),
  });

  function applyPeriod() {
    const n = parseInt(pendingPeriod, 10);
    if (Number.isFinite(n) && n > 0) setPeriodDays(n);
  }

  if (isError) {
    return <p className="mt-6 text-sm text-destructive">{t.adminAccessDenied}</p>;
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="period" className="text-xs">{t.adminPeriodLabel}</Label>
          <Input
            id="period"
            type="number"
            min={1}
            className="h-9 w-40"
            value={pendingPeriod}
            onChange={(e) => setPendingPeriod(e.target.value)}
            onBlur={applyPeriod}
            onKeyDown={(e) => e.key === "Enter" && applyPeriod()}
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-1.5 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          {t.adminRefresh}
        </Button>
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.adminColEmail}</TableHead>
              <TableHead>{t.adminColRegistered}</TableHead>
              <TableHead>{t.adminColLastLogin}</TableHead>
              <TableHead className="text-right">{t.adminColLogins}</TableHead>
              <TableHead className="text-right">{t.adminColDocs}</TableHead>
              <TableHead>{t.adminColMode}</TableHead>
              <TableHead>{t.adminColSubscription}</TableHead>
              <TableHead>{t.adminColAccess}</TableHead>
              <TableHead className="text-right">{t.adminColActions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">{t.loading}</TableCell></TableRow>
            ) : (data?.users.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">{t.adminNoUsers}</TableCell></TableRow>
            ) : (
              data!.users.map((u) => <UserRow key={u.user_id} u={u} grantMut={grantMut} revokeMut={revokeMut} />)
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function UserRow({
  u,
  grantMut,
  revokeMut,
}: {
  u: AdminUserRow;
  grantMut: ReturnType<typeof useMutation<unknown, Error, { userId: string; durationDays: number; plan: string }>>;
  revokeMut: ReturnType<typeof useMutation<unknown, Error, string>>;
}) {
  const { t, lang } = useLocale();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState("30");
  const [plan, setPlan] = useState("standard");

  const mode =
    u.production_count > 0 && u.sandbox_count > 0
      ? t.adminModeMixed
      : u.production_count > 0
        ? t.adminModeProduction
        : u.sandbox_count > 0
          ? t.adminModeSandbox
          : t.adminModeNone;

  const subLabel = u.is_admin
    ? t.adminBadgeAdmin
    : u.sub_status === "active" && u.sub_valid_until && new Date(u.sub_valid_until).getTime() > Date.now()
      ? `${t.adminSubActive}, ${t.adminSubUntil.replace("{date}", fmtDate(lang, u.sub_valid_until))}`
      : u.sub_status === "revoked"
        ? t.adminSubRevoked
        : u.sub_status === "active" || u.sub_status === "expired"
          ? t.adminSubExpired
          : t.adminSubNone;

  return (
    <TableRow>
      <TableCell className="font-medium">
        {u.email}
        {u.is_admin && <Badge variant="secondary" className="ml-2">{t.adminBadgeAdmin}</Badge>}
      </TableCell>
      <TableCell className="whitespace-nowrap text-sm">{fmtDate(lang, u.created_at)}</TableCell>
      <TableCell className="whitespace-nowrap text-sm">{fmtDate(lang, u.last_sign_in_at)}</TableCell>
      <TableCell className="text-right">{u.login_count}</TableCell>
      <TableCell className="text-right">{u.doc_count}</TableCell>
      <TableCell className="text-sm">{mode}</TableCell>
      <TableCell className="text-sm">{subLabel}</TableCell>
      <TableCell>
        <Badge variant={u.has_access ? "default" : "outline"}>
          {u.has_access ? t.adminAccessYes : t.adminAccessNo}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        {!u.is_admin && (
          <div className="flex justify-end gap-1.5">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">{t.adminGrant}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t.adminGrantTitle}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{t.adminGrantDays}</Label>
                    <Input type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t.adminGrantPlan}</Label>
                    <Input value={plan} onChange={(e) => setPlan(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    disabled={grantMut.isPending}
                    onClick={() => {
                      const d = parseInt(days, 10);
                      if (!Number.isFinite(d) || d <= 0) return;
                      grantMut.mutate(
                        { userId: u.user_id, durationDays: d, plan: plan.trim() || "standard" },
                        { onSuccess: () => setOpen(false) },
                      );
                    }}
                  >
                    {t.adminGrantConfirm}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            {u.has_access && (
              <Button
                variant="ghost"
                size="sm"
                disabled={revokeMut.isPending}
                onClick={() => {
                  if (confirm(t.adminRevokeConfirm)) revokeMut.mutate(u.user_id);
                }}
              >
                {t.adminRevoke}
              </Button>
            )}
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

function CodesTab() {
  const { t, lang } = useLocale();
  const qc = useQueryClient();
  const fetchCodes = useServerFn(adminListCodes);
  const generate = useServerFn(adminGenerateCodes);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-codes"],
    queryFn: () => fetchCodes(),
  });

  const [count, setCount] = useState("1");
  const [duration, setDuration] = useState("30");
  const [plan, setPlan] = useState("free");
  const [note, setNote] = useState("");
  const [codeExpiry, setCodeExpiry] = useState("");

  const genMut = useMutation({
    mutationFn: (v: { count: number; durationDays: number; plan: string; note?: string; codeExpiresInDays?: number }) =>
      generate({ data: v }),
    onSuccess: () => {
      toast.success(t.adminCodesGenerated);
      qc.invalidateQueries({ queryKey: ["admin-codes"] });
    },
    onError: (e) => toast.error(t.adminError, { description: String(e) }),
  });

  function onGenerate() {
    const c = parseInt(count, 10);
    const d = parseInt(duration, 10);
    if (!Number.isFinite(c) || c <= 0 || !Number.isFinite(d) || d <= 0) return;
    const ce = parseInt(codeExpiry, 10);
    genMut.mutate({
      count: c,
      durationDays: d,
      plan: plan.trim() || "free",
      note: note.trim() || undefined,
      codeExpiresInDays: Number.isFinite(ce) && ce > 0 ? ce : undefined,
    });
  }

  function codeStatus(c: { redeemed_by: string | null; code_expires_at: string | null }) {
    if (c.redeemed_by) return t.adminCodeUsed;
    if (c.code_expires_at && new Date(c.code_expires_at).getTime() < Date.now()) return t.adminCodeExpired;
    return t.adminCodeNew;
  }

  return (
    <div className="mt-4 space-y-6">
      <Card className="p-4">
        <h2 className="text-sm font-semibold">{t.adminGenTitle}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs">{t.adminGenCount}</Label>
            <Input type="number" min={1} value={count} onChange={(e) => setCount(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t.adminGenDuration}</Label>
            <Input type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t.adminGenPlan}</Label>
            <Input value={plan} onChange={(e) => setPlan(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t.adminGenCodeExpiry}</Label>
            <Input type="number" min={1} value={codeExpiry} onChange={(e) => setCodeExpiry(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">{t.adminGenNote}</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <Button className="mt-3" onClick={onGenerate} disabled={genMut.isPending}>
          {genMut.isPending ? t.adminGenerating : t.adminGenBtn}
        </Button>
      </Card>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.adminCodeColCode}</TableHead>
              <TableHead className="text-right">{t.adminCodeColDuration}</TableHead>
              <TableHead>{t.adminCodeColPlan}</TableHead>
              <TableHead>{t.adminCodeColNote}</TableHead>
              <TableHead>{t.adminCodeColStatus}</TableHead>
              <TableHead>{t.adminCodeColRedeemed}</TableHead>
              <TableHead>{t.adminCodeColCreated}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">{t.loading}</TableCell></TableRow>
            ) : (data?.codes.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">{t.adminNoCodes}</TableCell></TableRow>
            ) : (
              data!.codes.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-sm">{c.code}</TableCell>
                  <TableCell className="text-right">{c.duration_days} {t.adminDaysShort}</TableCell>
                  <TableCell className="text-sm">{c.plan}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.note ?? "—"}</TableCell>
                  <TableCell className="text-sm">{codeStatus(c)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.redeemed_email ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{fmtDate(lang, c.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(c.code).then(
                          () => toast.success(t.adminCodeCopied),
                          () => {},
                        );
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
