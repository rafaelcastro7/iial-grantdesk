import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  Bot,
  BrainCircuit,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Command,
  DollarSign,
  FileText,
  GitBranch,
  Home,
  Landmark,
  Library,
  LayoutGrid,
  ListChecks,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Radar,
  Lightbulb,
  RefreshCw,
  Scale,
  Search,
  Send,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trophy,
  Users,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

import { useIsAdmin, useIsConsultant, isConsultantPath } from "@/lib/use-platform";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLlmRouteStatus, type LlmRouteStatus } from "@/lib/llm-route.functions";
import { TenantReadinessBanner } from "@/components/org/TenantReadinessBanner";
import { useActiveTenant } from "@/lib/tenant-context";
const SIDEBAR_COLLAPSED_KEY = "iial.v2.sidebar.collapsed";

type NavItem = {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

type NavGroup = {
  label: string;
  accent: "teal" | "amber" | "violet" | "green" | "rose";
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Organizations",
    accent: "amber",
    items: [
      {
        to: "/clients",
        label: "Clients",
        description: "Profiles, readiness and matching grants",
        icon: Users,
      },
    ],
  },
  {
    label: "Every day",
    accent: "teal",
    items: [
      {
        to: "/dashboard",
        label: "Home",
        description: "Today, priorities, intelligence",
        icon: Home,
      },
      { to: "/grants", label: "Grant radar", description: "Discover and qualify", icon: Radar },
      {
        to: "/pipeline",
        label: "Pipeline",
        description: "Grants we are working, decisions, export",
        icon: ListChecks,
      },
      {
        to: "/insights",
        label: "Fit insights",
        description: "Why grants do not pass",
        icon: Lightbulb,
      },
      { to: "/funders", label: "Funders", description: "CRA, history, patterns", icon: Landmark },
    ],
  },
  {
    label: "Your applications",
    accent: "violet",
    items: [
      { to: "/proposals", label: "Proposals", description: "Drafts and sections", icon: FileText },
      {
        to: "/answers",
        label: "Answer library",
        description: "Approved reusable language",
        icon: Library,
      },
      { to: "/quality", label: "Quality check", description: "Scores and gaps", icon: BarChart3 },
      { to: "/submissions", label: "Submissions", description: "Sent, won, waiting", icon: Send },
    ],
  },
  {
    label: "After you win",
    accent: "green",
    items: [
      { to: "/post-award", label: "Awards", description: "Outcomes and reports", icon: Trophy },
      { to: "/financial", label: "Money", description: "Budget vs actuals", icon: DollarSign },
      { to: "/impact", label: "Impact", description: "Measures and evidence", icon: Target },
      { to: "/renewal", label: "Renewals", description: "Next-cycle likelihood", icon: RefreshCw },
    ],
  },
  {
    label: "Stay on track",
    accent: "rose",
    items: [
      { to: "/tasks", label: "Tasks", description: "Assignments and follow-up", icon: ListChecks },
      {
        to: "/compliance-calendar",
        label: "Deadlines",
        description: "Reports and reminders",
        icon: CalendarDays,
      },
      {
        to: "/competitive",
        label: "Market view",
        description: "Recipients and programs",
        icon: LayoutGrid,
      },
    ],
  },
  {
    label: "Set up",
    accent: "teal",
    items: [
      {
        to: "/org",
        label: "Organization profile",
        description: "Who you are and what you apply for",
        icon: Building2,
      },
      {
        to: "/fit-rules",
        label: "What we show you",
        description: "IIAL eligibility model",
        icon: SlidersHorizontal,
      },
      {
        to: "/backlog",
        label: "Design backlog",
        description: "Roadmap, ideas and improvements",
        icon: Lightbulb,
      },
      { to: "/manual", label: "Guide", description: "System guide", icon: BookOpen },
      {
        to: "/privacy",
        label: "Privacy & governance",
        description: "Consents, data rights, compliance",
        icon: Scale,
      },
    ],
  },
  {
    label: "Admin",
    accent: "amber",
    items: [
      {
        to: "/autonomy",
        label: "Autonomy",
        description: "Daemons, memory, lessons",
        icon: BrainCircuit,
        adminOnly: true,
      },
      {
        to: "/ops",
        label: "Operations",
        description: "Platform health",
        icon: Activity,
        adminOnly: true,
      },
      {
        to: "/admin",
        label: "Admin console",
        description: "Users, agents, modules",
        icon: Settings,
        adminOnly: true,
      },
      {
        to: "/admin/audit-trail",
        label: "Audit trail",
        description: "Decisions and activity history",
        icon: ClipboardList,
        adminOnly: true,
      },
      {
        to: "/admin/workflows",
        label: "Workflows",
        description: "Automation and processing rules",
        icon: GitBranch,
        adminOnly: true,
      },
    ],
  },
];

const LIFECYCLE = [
  { label: "Discover", icon: Search },
  { label: "Fit", icon: CheckCircle2 },
  { label: "Draft", icon: FileText },
  { label: "Submit", icon: Send },
  { label: "Award", icon: Trophy },
  { label: "Report", icon: CalendarDays },
];

const ACCENT_CLASS: Record<NavGroup["accent"], string> = {
  teal: "bg-brand-green",
  amber: "bg-amber-400",
  violet: "bg-violet-400",
  green: "bg-emerald-400",
  rose: "bg-rose-400",
};

export function V2AuthenticatedShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  // Shell renders on every authenticated page, so this must never suspend or
  // throw: assume the safer "cloud is in play" wording until it resolves.
  const fetchLlmRoute = useServerFn(getLlmRouteStatus);
  const { data: llmRoute = { cloudProviders: [], localOnly: false } } = useQuery({
    queryKey: ["llm-route-status"],
    queryFn: () => fetchLlmRoute({ data: {} }),
    staleTime: 5 * 60_000,
  });
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const isConsultant = useIsConsultant();
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      isConsultant ? isConsultantPath(item.to) : !item.adminOnly || isAdmin,
    ),
  })).filter((group) => group.items.length > 0);
  const activeItem = findActiveItem(currentPath, visibleGroups);

  // Read after mount: the server always renders expanded, so reading storage
  // during the first render would make the hydrated markup disagree.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true");
    } catch {
      // Storage blocked (private mode): stay expanded.
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // Not persisted; the toggle still works for this visit.
      }
      return next;
    });
  };

  async function signOut() {
    await supabase.auth.signOut();
    await navigate({ to: "/" });
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div data-ui-version="v2" className="min-h-screen bg-background text-foreground">
        <aside
          aria-label="Sidebar navigation"
          className={cn(
            "fixed inset-y-0 left-0 z-40 hidden border-r border-white/10 bg-sidebar text-white lg:flex lg:flex-col transition-all duration-300 ease-in-out",
            collapsed ? "w-[68px]" : "w-[280px]",
          )}
        >
          <V2DesktopNav
            activePath={currentPath}
            groups={visibleGroups}
            onSignOut={signOut}
            llmRoute={llmRoute}
            collapsed={collapsed}
            onToggleCollapse={toggleCollapsed}
          />
        </aside>

        <div
          className={cn(
            "min-h-screen transition-all duration-300 ease-in-out",
            collapsed ? "lg:pl-[68px]" : "lg:pl-[280px]",
          )}
        >
          <V2TopBar
            activeItem={activeItem}
            activePath={currentPath}
            groups={visibleGroups}
            onSignOut={signOut}
            llmRoute={llmRoute}
            collapsed={collapsed}
            onToggleCollapse={toggleCollapsed}
          />
          <TenantReadinessBanner />
          <main className="min-h-[calc(100vh-65px)] pb-10">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}

function V2DesktopNav({
  activePath,
  groups,
  onSignOut,
  llmRoute,
  collapsed = false,
  onToggleCollapse,
}: {
  activePath: string;
  groups: NavGroup[];
  onSignOut: () => void;
  llmRoute: LlmRouteStatus;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const simple = useIsConsultant();
  return (
    <>
      <div
        className={cn(
          "border-b border-white/10 transition-all duration-200",
          collapsed ? "px-2 py-3" : "px-5 py-4",
        )}
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-2.5">
            <Link to="/dashboard" className="group flex items-center justify-center">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-md bg-white text-xs font-black text-brand-deep shadow-sm hover:scale-105 transition-transform"
                title="IIAL Grants"
              >
                II
              </div>
            </Link>
            {onToggleCollapse && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onToggleCollapse}
                    className="h-8 w-8 text-white/70 hover:bg-white/10 hover:text-white"
                  >
                    <PanelLeftOpen className="h-4 w-4" />
                    <span className="sr-only">Expand sidebar</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Expand sidebar</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={openCommandPalette}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-white/12 bg-white/[0.06] text-brand-green hover:bg-white/[0.1] transition-colors"
                >
                  <Command className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Search (Cmd K)</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between">
              <Link to="/dashboard" className="group flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-sm font-black text-brand-deep shadow-sm">
                  II
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold tracking-normal">IIAL Grants</div>
                  <div className="text-xs text-white/56">Opportunity operating system</div>
                </div>
              </Link>
              {onToggleCollapse && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={onToggleCollapse}
                      className="h-8 w-8 text-white/70 hover:bg-white/10 hover:text-white"
                    >
                      <PanelLeftClose className="h-4 w-4" />
                      <span className="sr-only">Collapse sidebar</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Collapse sidebar</TooltipContent>
                </Tooltip>
              )}
            </div>

            <button
              type="button"
              onClick={openCommandPalette}
              className="mt-4 flex w-full items-center justify-between rounded-md border border-white/12 bg-white/[0.06] px-3 py-2 text-left text-sm text-white/86 transition-colors hover:bg-white/[0.1]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Command className="h-4 w-4 shrink-0 text-brand-green" />
                <span className="truncate">Search grants, funders, proposals</span>
              </span>
              <kbd className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] text-white/56">
                Cmd K
              </kbd>
            </button>
          </div>
        )}
      </div>

      <nav
        className={cn(
          "flex-1 overflow-y-auto transition-all duration-200",
          collapsed ? "px-1.5 py-3" : "px-3 py-4",
        )}
        aria-label="Primary"
      >
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <div className="mb-1.5 flex items-center gap-2 px-2 text-[11px] font-semibold uppercase tracking-normal text-white/46">
                  <span className={cn("h-1.5 w-1.5 rounded-full", ACCENT_CLASS[group.accent])} />
                  {group.label}
                </div>
              )}
              {collapsed && <div className="my-2 h-px bg-white/10 mx-2" title={group.label} />}
              <div className="space-y-1">
                {group.items.map((item) => (
                  <V2NavLink
                    key={item.to}
                    item={item}
                    active={isPathActive(activePath, item.to)}
                    collapsed={collapsed}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>

      <div
        className={cn(
          "border-t border-white/10 transition-all duration-200",
          collapsed ? "p-2" : "p-3",
        )}
      >
        {!simple && !collapsed && (
          <div className="rounded-md border border-white/10 bg-white/[0.055] p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <Bot className="h-4 w-4 text-brand-green" />
              AI stack
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] text-white/62">
              <span className="rounded-[6px] bg-white/[0.07] px-2 py-1">Lovable AI</span>
              <span className="rounded-[6px] bg-white/[0.07] px-2 py-1">Lovable Cloud</span>
              <span className="rounded-[6px] bg-white/[0.07] px-2 py-1">RLS</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help rounded-[6px] bg-white/[0.07] px-2 py-1 underline decoration-dotted underline-offset-2">
                    {llmRoute.cloudProviders[0] ?? "Lovable AI"}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-64 text-xs">
                  Agents call the Lovable AI Gateway — always read AI-drafted text before
                  submitting, never take it as final.
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}

        {!simple && collapsed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex h-9 w-9 mx-auto items-center justify-center rounded-md border border-white/10 bg-white/[0.055] text-brand-green cursor-pointer mb-2">
                <Bot className="h-4 w-4" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              AI stack active: Lovable AI / Cloud
            </TooltipContent>
          </Tooltip>
        )}

        <div
          className={cn(
            "flex items-center",
            collapsed ? "justify-center" : "justify-end gap-2 mt-3",
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white/70 hover:bg-white/10 hover:text-white"
                onClick={onSignOut}
              >
                <LogOut className="h-4 w-4" />
                <span className="sr-only">Sign out</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side={collapsed ? "right" : "top"}>Sign out</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </>
  );
}

function V2TopBar({
  activeItem,
  activePath,
  groups,
  onSignOut,
  llmRoute,
  collapsed = false,
  onToggleCollapse,
}: {
  activeItem?: NavItem;
  activePath: string;
  groups: NavGroup[];
  onSignOut: () => void;
  llmRoute: LlmRouteStatus;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const Icon = activeItem?.icon ?? Sparkles;

  const simple = useIsConsultant();
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md transition-colors">
      <div className="flex h-16 items-center justify-between gap-3 px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <V2MobileNav
            activePath={activePath}
            groups={groups}
            onSignOut={onSignOut}
            llmRoute={llmRoute}
          />
          {onToggleCollapse && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onToggleCollapse}
                  className="hidden h-9 w-9 text-muted-foreground hover:text-foreground lg:flex"
                >
                  {collapsed ? (
                    <PanelLeftOpen className="h-4 w-4" />
                  ) : (
                    <PanelLeftClose className="h-4 w-4" />
                  )}
                  <span className="sr-only">
                    {collapsed ? "Expand sidebar" : "Collapse sidebar"}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {collapsed ? "Expand sidebar" : "Collapse sidebar"}
              </TooltipContent>
            </Tooltip>
          )}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary shadow-xs">
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              IIAL Grants
              <ChevronRight className="h-3 w-3 opacity-60" />
              <span>Workspace</span>
            </div>
            <div className="truncate text-sm font-semibold tracking-tight text-foreground">
              {activeItem?.label ?? "IIAL Command Center"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <TenantSelector />
          <Button
            variant="outline"
            size="sm"
            className="hidden min-w-[240px] justify-start gap-2 border-border/60 bg-card/60 text-muted-foreground shadow-2xs hover:border-primary/40 hover:bg-card md:flex"
            onClick={openCommandPalette}
          >
            <Search className="h-4 w-4 text-primary/70" />
            <span className="text-xs">Search grants, funders...</span>
            <kbd className="ml-auto rounded border border-border/80 bg-muted/80 px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
              ⌘K
            </kbd>
          </Button>

          {!simple && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="hidden cursor-help items-center gap-2 rounded-lg border-border/60 bg-card/60 px-2.5 py-1 text-xs font-medium md:inline-flex"
                >
                  <span className="relative flex h-2 w-2">
                    <span
                      className={cn(
                        "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                        llmRoute.localOnly ? "bg-emerald-400" : "bg-brand-green",
                      )}
                    />
                    <span
                      className={cn(
                        "relative inline-flex h-2 w-2 rounded-full",
                        llmRoute.localOnly ? "bg-emerald-500" : "bg-brand-bright",
                      )}
                    />
                  </span>
                  Lovable AI
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-72 text-xs">
                {`Analysis and drafting run through ${llmRoute.cloudProviders.join(", ") || "Lovable AI"}. Eligibility verdicts stay rule-based.`}
              </TooltipContent>
            </Tooltip>
          )}

          <ThemeToggle />
          <NotificationBell />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 border-border/60"
                onClick={openCommandPalette}
              >
                <Command className="h-4 w-4" />
                <span className="sr-only">Open command palette</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Command palette</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {!simple && (
        <div className="hidden border-t border-border/55 px-5 py-2 xl:block">
          <div className="flex items-center gap-2 overflow-hidden text-[11px] text-muted-foreground">
            {LIFECYCLE.map((stage, index) => {
              const StageIcon = stage.icon;
              return (
                <div key={stage.label} className="flex min-w-0 items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 font-medium text-foreground">
                    <StageIcon className="h-3.5 w-3.5 text-primary" />
                    {stage.label}
                  </span>
                  {index < LIFECYCLE.length - 1 && <ChevronRight className="h-3.5 w-3.5" />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}

function TenantSelector() {
  const { organizations, activeOrgId, isLoading, setActiveOrgId } = useActiveTenant();
  if (!isLoading && organizations.length === 0) return null;

  return (
    <label className="relative hidden items-center gap-2 rounded-lg border border-border/60 bg-card/70 px-2.5 py-1.5 shadow-2xs sm:flex">
      <Building2 className="h-4 w-4 shrink-0 text-primary" />
      <span className="sr-only">Active organization</span>
      <select
        aria-label="Active organization"
        value={activeOrgId ?? ""}
        disabled={isLoading || organizations.length === 0}
        onChange={(event) => setActiveOrgId(event.target.value)}
        className="max-w-[170px] cursor-pointer appearance-none truncate bg-transparent pr-4 text-xs font-semibold text-foreground outline-none disabled:cursor-wait"
      >
        {!activeOrgId && <option value="">Loading workspace…</option>}
        {organizations.map((organization) => (
          <option key={organization.id} value={organization.id}>
            {organization.name}
          </option>
        ))}
      </select>
      {organizations.length > 1 && (
        <ChevronRight className="pointer-events-none absolute right-2 h-3 w-3 rotate-90 text-muted-foreground" />
      )}
    </label>
  );
}

function V2MobileNav({
  activePath,
  groups,
  onSignOut,
  llmRoute,
}: {
  activePath: string;
  groups: NavGroup[];
  onSignOut: () => void;
  llmRoute: LlmRouteStatus;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9 lg:hidden">
          <Menu className="h-4 w-4" />
          <span className="sr-only">Open navigation</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[320px] max-w-[86vw] border-white/10 bg-sidebar p-0 text-white"
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <V2DesktopNav
          activePath={activePath}
          groups={groups}
          onSignOut={onSignOut}
          llmRoute={llmRoute}
        />
      </SheetContent>
    </Sheet>
  );
}

function V2NavLink({
  item,
  active,
  collapsed = false,
}: {
  item: NavItem;
  active: boolean;
  collapsed?: boolean;
}) {
  const Icon = item.icon;

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to={item.to}
            className={cn(
              "group flex h-10 w-10 items-center justify-center rounded-md mx-auto transition-colors",
              active
                ? "bg-white text-brand-deep shadow-sm"
                : "text-white/72 hover:bg-white/[0.08] hover:text-white",
            )}
          >
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md border",
                active ? "border-black/5 bg-brand-green" : "border-white/10 bg-white/[0.06]",
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="sr-only">{item.label}</span>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" className="flex flex-col gap-0.5 max-w-56">
          <span className="font-semibold text-xs text-foreground">{item.label}</span>
          <span className="text-[11px] text-muted-foreground">{item.description}</span>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Link
      to={item.to}
      className={cn(
        "group flex min-h-12 items-center gap-3 rounded-md px-2.5 py-2 transition-colors",
        active
          ? "bg-white text-brand-deep shadow-sm"
          : "text-white/72 hover:bg-white/[0.08] hover:text-white",
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
          active ? "border-black/5 bg-brand-green" : "border-white/10 bg-white/[0.06]",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold tracking-normal">{item.label}</span>
        <span className={cn("block truncate text-xs", active ? "text-black/55" : "text-white/42")}>
          {item.description}
        </span>
      </span>
    </Link>
  );
}

function findActiveItem(path: string, groups: NavGroup[]) {
  return groups
    .flatMap((group) => group.items)
    .filter((item) => isPathActive(path, item.to))
    .sort((a, b) => b.to.length - a.to.length)[0];
}

function isPathActive(currentPath: string, itemPath: string) {
  return itemPath === "/dashboard"
    ? currentPath === "/dashboard"
    : currentPath.startsWith(itemPath);
}

function openCommandPalette() {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
}
