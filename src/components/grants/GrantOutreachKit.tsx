import { useState } from "react";
import {
  Bot,
  Check,
  Copy,
  Mail,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { OutreachKit, RouteId } from "@/lib/grant-roadmap";

export function GrantOutreachKit({
  outreach,
  selectedRouteId,
  onOpenCopilot,
}: {
  outreach: OutreachKit;
  selectedRouteId: RouteId;
  onOpenCopilot: (initialPrompt?: string) => void;
}) {
  const [activeTemplateIdx, setActiveTemplateIdx] = useState(0);
  const [copied, setCopied] = useState(false);

  const currentTemplate = outreach.templates[activeTemplateIdx] || outreach.templates[0];

  const handleCopy = () => {
    if (!currentTemplate) return;
    const fullText = `Subject: ${currentTemplate.subject}\n\n${currentTemplate.body}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConsultCopilot = () => {
    if (!currentTemplate) return;
    const prompt = `Help me refine and customize this institutional outreach email for ${currentTemplate.title}. The current draft is:\n\n${currentTemplate.body}\n\nWhat adjustments would maximize partner response rates?`;
    onOpenCopilot(prompt);
  };

  return (
    <Card className="border-border/70 shadow-sm bg-card overflow-hidden">
      <CardHeader className="bg-muted/15 border-b px-4 py-3 sm:px-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              Operational Action Plan &amp; Consortium Outreach Kit
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Immediate tactical steps and institutional email drafts ready to engage consortium partners and program officers
            </p>
          </div>
          <Badge variant="outline" className="text-xs py-0.5 self-start sm:self-auto">
            {outreach.immediateSteps.length} action items
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-5">
        {/* Immediate Numbered Steps */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Immediate Roadmap (Next Steps)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {outreach.immediateSteps.map((step, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 rounded-lg border bg-background/80 p-3 text-xs leading-relaxed"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary text-[11px]">
                  {idx + 1}
                </span>
                <span className="font-medium text-foreground">{step.replace(/^\d+\.\s*/, "")}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Institutional Outreach Templates Generator */}
        <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Institutional Outreach Templates:
              </span>
            </div>

            {/* Template selector tabs */}
            <div className="flex flex-wrap gap-1.5">
              {outreach.templates.map((tmpl, idx) => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => setActiveTemplateIdx(idx)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                    activeTemplateIdx === idx
                      ? "bg-primary text-primary-foreground shadow-2xs font-semibold"
                      : "bg-background border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tmpl.title.split("(")[0].trim()}
                </button>
              ))}
            </div>
          </div>

          {currentTemplate && (
            <div className="space-y-2.5 rounded-lg border bg-background/95 p-3.5 shadow-2xs">
              <div className="space-y-1 pb-2 border-b">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase text-muted-foreground">Recipient:</span>
                  <Badge variant="secondary" className="text-[10px] py-0 font-medium">
                    {currentTemplate.title}
                  </Badge>
                </div>
                <div className="text-xs font-semibold text-foreground">
                  <span className="text-muted-foreground font-normal">Subject: </span>
                  {currentTemplate.subject}
                </div>
              </div>

              <div className="whitespace-pre-line text-xs font-mono leading-relaxed text-foreground/90 bg-muted/20 p-3 rounded-md border max-h-[220px] overflow-y-auto">
                {currentTemplate.body}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-muted-foreground">
                  Customize and review this draft prior to transmission.
                </span>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy Draft</span>
                      </>
                    )}
                  </Button>

                  <Button
                    size="sm"
                    className="h-8 text-xs gap-1.5 font-semibold"
                    onClick={handleConsultCopilot}
                  >
                    <Bot className="h-3.5 w-3.5" />
                    <span>Refine with Copilot</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
