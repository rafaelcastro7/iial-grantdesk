import { z } from "zod";
import { CALL_STATUSES, CHECK_STATUSES, INSTRUMENTS, PRIORITIES, ROUTES } from "./grant-workspace.shared";

const PartnerSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().max(200),
  country: z.string().max(80).nullable().optional(),
  type: z.string().max(80).nullable().optional(),
  role: z.string().max(200).nullable().optional(),
  contact: z.string().max(300).nullable().optional(),
  status: z
    .enum(["to_contact", "contacted", "interested", "confirmed", "declined"])
    .nullable()
    .optional(),
});
export const ChecklistSchema = z.object({
  id: z.string().min(1).max(80),
  item: z.string().min(1).max(300),
  status: z.enum(CHECK_STATUSES),
  owner: z.string().max(120).nullable().optional(),
  due: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  critical: z.boolean().optional(),
  basis: z.enum(["published", "operational", "verify"]).optional(),
  detail: z.string().max(500).optional(),
});
const MilestoneSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  done: z.boolean().optional(),
});

export const WorkspaceSaveSchema = z.object({
        org_id: z.string().uuid(),
        grant_id: z.string().uuid(),
        priority: z.enum(PRIORITIES),
        applicant_org_ids: z.array(z.string().uuid()).max(10),
        route: z.enum(ROUTES).nullable(),
        lead_institution: z.string().max(200).nullable(),
        administrator: z.string().max(200).nullable(),
        call_status: z.enum(CALL_STATUSES).nullable(),
        deadline_time: z.string().max(20).nullable(),
        deadline_timezone: z.string().max(20).nullable(),
        instrument: z.enum(INSTRUMENTS).nullable(),
        match_pct: z.number().min(0).max(100).nullable(),
        match_in_kind_ok: z.boolean().nullable(),
        project_title: z.string().max(300).nullable(),
        wcis_angle: z.string().max(2000).nullable(),
        blockers: z.array(z.string().max(300)).max(20),
        partners: z.array(PartnerSchema).max(30),
        checklist: z.array(ChecklistSchema).max(60),
        milestones: z.array(MilestoneSchema).max(30),
        decision_notes: z.string().max(4000).nullable(),
        verified_at: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable(),
});
