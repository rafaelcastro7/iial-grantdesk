import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getComplianceCalendar,
  getComplianceStats,
  createComplianceItem,
  markComplianceComplete,
} from "@/lib/compliance-calendar.functions";
import { PageTransition } from "@/components/PageTransition";
import { toast } from "sonner";
import {
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  Download,
  List,
  Grid3X3,
} from "lucide-react";
import { cn } from "@/lib/utils";

const calendarQO = queryOptions({
  queryKey: ["compliance", "calendar"],
  queryFn: () => getComplianceCalendar({ data: {} }),
});

const statsQO = queryOptions({
  queryKey: ["compliance", "stats"],
  queryFn: () => getComplianceStats({ data: {} }),
});

export const Route = createFileRoute("/_authenticated/compliance-calendar")({
  head: () => ({ meta: [{ title: "Compliance Calendar — IIAL" }] }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(calendarQO);
    await context.queryClient.ensureQueryData(statsQO);
  },
  component: ComplianceCalendarPage,
});

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getMonthDays(year: number, month: number) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay();
  const days: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(d);
  return days;
}

function generateICal(
  items: { title: string; due_date: string; type: string; description?: string }[],
) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//IIAL//Compliance Calendar//EN",
    "CALSCALE:GREGORIAN",
  ];
  for (const item of items) {
    const d = item.due_date.replace(/-/g, "");
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${item.title.replace(/\s+/g, "-")}@iial`);
    lines.push(`DTSTART;VALUE=DATE:${d}`);
    lines.push(`DTEND;VALUE=DATE:${d}`);
    lines.push(`SUMMARY:${item.title}`);
    if (item.description) lines.push(`DESCRIPTION:${item.description}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function ComplianceCalendarPage() {
  const fetchCalendar = useServerFn(getComplianceCalendar);
  const { data: items } = useSuspenseQuery({
    queryKey: ["compliance", "calendar"],
    queryFn: () => fetchCalendar({ data: {} }),
  });

  const fetchStats = useServerFn(getComplianceStats);
  const { data: stats } = useSuspenseQuery({
    queryKey: ["compliance", "stats"],
    queryFn: () => fetchStats({ data: {} }),
  });

  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [formValues, setFormValues] = useState({
    title: "",
    type: "progress_report" as const,
    dueDate: "",
    frequency: "once" as const,
  });

  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [gridDate, setGridDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["compliance", "calendar"] });
    queryClient.invalidateQueries({ queryKey: ["compliance", "stats"] });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      createComplianceItem({
        data: {
          title: formValues.title,
          type: formValues.type,
          dueDate: formValues.dueDate,
          frequency: formValues.frequency,
        },
      }),
    onSuccess: () => {
      toast.success("Compliance item created");
      setCreateOpen(false);
      setFormValues({ title: "", type: "progress_report", dueDate: "", frequency: "once" });
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const completeMutation = useMutation({
    mutationFn: (itemId: string) => markComplianceComplete({ data: { itemId } }),
    onSuccess: () => {
      toast.success("Item marked complete");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const gridYear = gridDate.getFullYear();
  const gridMonth = gridDate.getMonth();
  const gridDays = useMemo(() => getMonthDays(gridYear, gridMonth), [gridYear, gridMonth]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const item of items) {
      const existing = map.get(item.due_date) || [];
      existing.push(item);
      map.set(item.due_date, existing);
    }
    return map;
  }, [items]);

  function exportICS() {
    const ics = generateICal(
      items
        .filter((i) => i.due_date && i.title)
        .map((i) => ({
          title: i.title as string,
          due_date: i.due_date as string,
          type: i.type ?? "",
          description: i.description ?? undefined,
        })),
    );
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "compliance-calendar.ics";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Calendar exported (.ics)");
  }

  return (
    <ComplianceCalendarPageV2
      items={items}
      stats={stats}
      completeMutation={completeMutation}
      createMutation={createMutation}
      createOpen={createOpen}
      setCreateOpen={setCreateOpen}
      formValues={formValues}
      setFormValues={setFormValues}
      exportICS={exportICS}
      viewMode={viewMode}
      setViewMode={setViewMode}
      gridDate={gridDate}
      setGridDate={setGridDate}
      gridDays={gridDays}
      itemsByDate={itemsByDate}
      selectedDate={selectedDate}
      setSelectedDate={setSelectedDate}
    />
  );
}

// -----------------------------------------------------------------------------
// V2 — friendly redesign (presentation only; same items/stats/completeMutation)
// -----------------------------------------------------------------------------

type CalendarItems = Awaited<ReturnType<typeof getComplianceCalendar>>;
type ComplianceStats = Awaited<ReturnType<typeof getComplianceStats>>;

function bucketDeadlines(items: CalendarItems) {
  const thisWeek: CalendarItems = [];
  const thisMonth: CalendarItems = [];
  const later: CalendarItems = [];
  for (const item of items) {
    const days = item.daysUntilDue;
    if (days == null || days > 30) later.push(item);
    else if (days <= 7) thisWeek.push(item);
    else thisMonth.push(item);
  }
  return { thisWeek, thisMonth, later };
}

function ComplianceCalendarPageV2({
  items,
  stats,
  completeMutation,
  createMutation,
  createOpen,
  setCreateOpen,
  formValues,
  setFormValues,
  exportICS,
  viewMode,
  setViewMode,
  gridDate,
  setGridDate,
  gridDays,
  itemsByDate,
  selectedDate,
  setSelectedDate,
}: {
  items: CalendarItems;
  stats: ComplianceStats;
  completeMutation: { mutate: (itemId: string) => void; isPending: boolean };
  createMutation: { mutate: () => void; isPending: boolean };
  createOpen: boolean;
  setCreateOpen: (open: boolean) => void;
  formValues: {
    title: string;
    type: "progress_report";
    dueDate: string;
    frequency: "once";
  };
  setFormValues: React.Dispatch<
    React.SetStateAction<{
      title: string;
      type: "progress_report";
      dueDate: string;
      frequency: "once";
    }>
  >;
  exportICS: () => void;
  viewMode: "list" | "grid";
  setViewMode: (mode: "list" | "grid") => void;
  gridDate: Date;
  setGridDate: (date: Date) => void;
  gridDays: (number | null)[];
  itemsByDate: Map<string, CalendarItems>;
  selectedDate: string | null;
  setSelectedDate: (date: string | null) => void;
}) {
  const groups = bucketDeadlines(items.filter((i) => i.status !== "completed"));
  const gridYear = gridDate.getFullYear();
  const gridMonth = gridDate.getMonth();

  return (
    <PageTransition>
      <div className="min-h-screen text-foreground">
        <section className="mx-auto max-w-[1100px] space-y-5 px-4 py-6 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Deadlines</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Reports and applications due, soonest first.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={exportICS}>
                <Download className="h-4 w-4" /> Export .ics
              </Button>
              <div className="inline-flex rounded-md border bg-card p-0.5">
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode("list")}
                  title="List view"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode("grid")}
                  title="Calendar view"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
              </div>
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4" /> Add deadline
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add deadline</DialogTitle>
                  </DialogHeader>
                  <form
                    className="space-y-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!formValues.title || !formValues.dueDate) {
                        toast.error("Title and due date are required");
                        return;
                      }
                      createMutation.mutate();
                    }}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="v2-deadline-title">Title</Label>
                      <Input
                        id="v2-deadline-title"
                        value={formValues.title}
                        onChange={(event) =>
                          setFormValues((value) => ({ ...value, title: event.target.value }))
                        }
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="v2-deadline-type">Type</Label>
                        <select
                          id="v2-deadline-type"
                          value={formValues.type}
                          onChange={(event) =>
                            setFormValues((value) => ({
                              ...value,
                              type: event.target.value as typeof value.type,
                            }))
                          }
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="progress_report">Progress report</option>
                          <option value="financial_report">Financial report</option>
                          <option value="final_report">Final report</option>
                          <option value="audit">Audit</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="v2-deadline-date">Due date</Label>
                        <Input
                          id="v2-deadline-date"
                          type="date"
                          value={formValues.dueDate}
                          onChange={(event) =>
                            setFormValues((value) => ({ ...value, dueDate: event.target.value }))
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="v2-deadline-frequency">Frequency</Label>
                      <select
                        id="v2-deadline-frequency"
                        value={formValues.frequency}
                        onChange={(event) =>
                          setFormValues((value) => ({
                            ...value,
                            frequency: event.target.value as typeof value.frequency,
                          }))
                        }
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="once">Once</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="semi_annual">Semi-annual</option>
                        <option value="annual">Annual</option>
                      </select>
                    </div>
                    <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                      {createMutation.isPending ? "Adding…" : "Add deadline"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <p className="text-xs">Total</p>
                </div>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{stats.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4" />
                  <p className="text-xs">Done</p>
                </div>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-600">
                  {stats.completed}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <AlertTriangle className="h-4 w-4" />
                  <p className="text-xs">Overdue</p>
                </div>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-rose-600">
                  {stats.overdue}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <p className="text-xs">On track</p>
                </div>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{stats.complianceRate}%</p>
              </CardContent>
            </Card>
          </div>

          {viewMode === "grid" ? (
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">
                  {MONTHS[gridMonth]} {gridYear}
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setGridDate(new Date(gridYear, gridMonth - 1, 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setGridDate(new Date())}>
                    Today
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setGridDate(new Date(gridYear, gridMonth + 1, 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border bg-border">
                  {DAYS.map((day) => (
                    <div
                      key={day}
                      className="bg-muted px-1 py-2 text-center text-xs font-medium text-muted-foreground"
                    >
                      {day}
                    </div>
                  ))}
                  {gridDays.map((day, index) => {
                    if (day === null)
                      return <div key={`empty-${index}`} className="min-h-16 bg-background/60" />;
                    const date = `${gridYear}-${String(gridMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const dayItems = itemsByDate.get(date) ?? [];
                    return (
                      <Button
                        key={date}
                        variant="ghost"
                        onClick={() => setSelectedDate(selectedDate === date ? null : date)}
                        className={cn(
                          "h-16 min-w-0 flex-col gap-1 rounded-none bg-background p-1",
                          selectedDate === date && "bg-primary/10",
                        )}
                      >
                        <span>{day}</span>
                        {dayItems.length > 0 && (
                          <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                            {dayItems.length}
                          </Badge>
                        )}
                      </Button>
                    );
                  })}
                </div>
                {selectedDate && (
                  <div className="mt-4">
                    <DeadlineGroup
                      title={`Deadlines on ${selectedDate}`}
                      items={itemsByDate.get(selectedDate) ?? []}
                      completeMutation={completeMutation}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              <DeadlineGroup
                title="This week"
                items={groups.thisWeek}
                completeMutation={completeMutation}
              />
              <DeadlineGroup
                title="This month"
                items={groups.thisMonth}
                completeMutation={completeMutation}
              />
              <DeadlineGroup
                title="Later"
                items={groups.later}
                completeMutation={completeMutation}
              />
            </>
          )}

          {items.length === 0 && (
            <div className="rounded-lg border border-dashed bg-card px-5 py-12 text-center">
              <p className="text-sm text-muted-foreground">No deadlines tracked yet.</p>
            </div>
          )}
        </section>
      </div>
    </PageTransition>
  );
}

function DeadlineGroup({
  title,
  items,
  completeMutation,
}: {
  title: string;
  items: CalendarItems;
  completeMutation: { mutate: (itemId: string) => void; isPending: boolean };
}) {
  if (items.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 rounded-md border p-3">
            <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-md bg-muted text-[10px] font-semibold leading-tight">
              {item.due_date?.slice(5) ?? "—"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{item.title}</span>
                <Badge variant="outline" className="text-[10px]">
                  {item.type.replace(/_/g, " ")}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{item.grantTitle}</p>
            </div>
            <div className="shrink-0 text-right text-xs">
              {item.daysUntilDue != null && (
                <span className={item.daysUntilDue < 0 ? "text-rose-600" : "text-muted-foreground"}>
                  {item.daysUntilDue < 0
                    ? `${Math.abs(item.daysUntilDue)}d overdue`
                    : `${item.daysUntilDue}d left`}
                </span>
              )}
            </div>
            <button
              onClick={() => completeMutation.mutate(item.id)}
              disabled={completeMutation.isPending}
              className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600 disabled:opacity-50"
              title="Mark as complete"
            >
              <CheckCircle2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
