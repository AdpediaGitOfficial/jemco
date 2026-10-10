import { z } from "zod";
import {
  ComplaintType, Source, Process, Priority, QuantityUnit, RejectionReason,
} from "./enums";

const enumValues = <T extends Record<string, string>>(e: T) =>
  Object.values(e) as [T[keyof T], ...T[keyof T][]];

/** Part 1: what the issuer sends. One schema validates on both sides. */
export const CreateComplaintSchema = z
  .object({
    type: z.enum(enumValues(ComplaintType)),
    source: z.enum(enumValues(Source)),
    sourceOther: z.string().trim().max(120).optional(),
    process: z.enum(enumValues(Process)),
    processOther: z.string().trim().max(120).optional(),
    priority: z.enum(enumValues(Priority)),
    customerName: z.string().trim().max(160).optional(),
    supplierName: z.string().trim().max(160).optional(),
    poDoNumber: z.string().trim().min(1, "required").max(60),
    deliveryDate: z.iso.date().optional(),
    cefNumber: z.string().trim().max(60).optional(),
    quantity: z.number().positive().max(1_000_000),
    quantityUnit: z.enum(enumValues(QuantityUnit)),
    description: z.string().trim().min(50, "min50").max(5000),
    attachmentIds: z.array(z.string().uuid()).max(10).default([]),
  })
  .superRefine((v, ctx) => {
    if (v.source === "CUSTOMER" && !v.customerName)
      ctx.addIssue({ code: "custom", path: ["customerName"], message: "required" });
    if (v.source === "SUPPLIER" && !v.supplierName)
      ctx.addIssue({ code: "custom", path: ["supplierName"], message: "required" });
    if (v.source === "OTHER" && !v.sourceOther)
      ctx.addIssue({ code: "custom", path: ["sourceOther"], message: "required" });
    if (v.process === "OTHER" && !v.processOther)
      ctx.addIssue({ code: "custom", path: ["processOther"], message: "required" });
  });
export type CreateComplaintInput = z.input<typeof CreateComplaintSchema>;
export type CreateComplaint = z.output<typeof CreateComplaintSchema>;

/** Part 2A: QA validation decision. */
export const TriageDecisionSchema = z.discriminatedUnion("decision", [
  z.object({
    decision: z.literal("ACCEPT"),
    priority: z.enum(enumValues(Priority)),
    priorityChangeReason: z.string().trim().max(500).optional(),
    departmentId: z.string().uuid(),
    assigneeId: z.string().uuid(),
    notes: z.string().trim().max(2000).optional(),
  }),
  z.object({
    decision: z.literal("REJECT"),
    reason: z.enum(enumValues(RejectionReason)),
    reasonText: z.string().trim().min(1).max(1000),
    duplicateOfComplaintId: z.string().uuid().optional(),
  }),
  z.object({
    decision: z.literal("NEED_MORE_INFO"),
    question: z.string().trim().min(1).max(1000),
  }),
]);
export type TriageDecision = z.infer<typeof TriageDecisionSchema>;

export const LoginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginSchema>;

/** Issuer answers QA's question (NEED_MORE_INFO -> SUBMITTED). */
export const AnswerInfoSchema = z.object({ answer: z.string().trim().min(1).max(2000) });
export type AnswerInfo = z.infer<typeof AnswerInfoSchema>;

/** Part 2B: PIC saves or submits the action. Submit enforces completeness in the API. */
export const ActionItemSchema = z.object({
  id: z.string().uuid().optional(),
  description: z.string().trim().min(1).max(500),
  ownerId: z.string().uuid(),
  dueDate: z.iso.date(),
  done: z.boolean().default(false),
});
export const SaveActionSchema = z.object({
  containment: z.string().trim().max(3000).optional(),
  rootCause: z.string().trim().max(5000).optional(),
  rootCauseCategory: z.string().trim().max(40).optional(),
  actionPlan: z.string().trim().max(5000).optional(),
  actions: z.array(ActionItemSchema).max(20).default([]),
});
export type SaveActionInput = z.input<typeof SaveActionSchema>;
export type SaveAction = z.output<typeof SaveActionSchema>;

/** Part 3: QA verification. */
export const VerifySchema = z.discriminatedUnion("result", [
  z.object({
    result: z.literal("SATISFACTORY"),
    dispositions: z.array(z.string().trim().min(1)).min(1),
    dispositionNote: z.string().trim().max(1000).optional(),
    costOfNc: z.number().nonnegative().optional(),
    qaJustification: z.string().trim().min(1).max(3000),
  }),
  z.object({
    result: z.literal("NON_SATISFACTORY"),
    returnReason: z.string().trim().min(1).max(3000),
    qaJustification: z.string().trim().min(1).max(3000),
  }),
]);
export type VerifyInput = z.infer<typeof VerifySchema>;

export const ReopenSchema = z.object({ reason: z.string().trim().min(1).max(1000) });

/** Admin: lookup options, routing, SLA, calendar, users. QA manager only. */
export const LookupOptionSchema = z.object({
  code: z.string().trim().regex(/^[A-Z0-9_]{2,40}$/, "code"),
  labelEn: z.string().trim().min(1).max(120),
  labelMs: z.string().trim().min(1).max(120),
  helpEn: z.string().trim().max(200).optional().nullable(),
  helpMs: z.string().trim().max(200).optional().nullable(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(999).optional(),
});
export const LookupOptionPatchSchema = LookupOptionSchema.omit({ code: true }).partial();

export const RoutingSchema = z.object({
  departmentId: z.string().uuid(),
  primaryPicId: z.string().uuid().nullable().optional(),
  backupPicId: z.string().uuid().nullable().optional(),
});

export const SlaPolicySchema = z.object({
  triageDays: z.number().int().min(0).max(60),
  responseDays: z.number().int().min(0).max(60),
  resolutionDays: z.number().int().min(1).max(365),
  verificationDays: z.number().int().min(0).max(60),
});

export const HolidaySchema = z.object({ date: z.iso.date(), reason: z.string().trim().min(1).max(80) });

const RoleEnum = z.enum(["ISSUER", "PIC", "DEPT_MANAGER", "QA_COORDINATOR", "QA_MANAGER", "AUDITOR"]);
export const CreateUserSchema = z.object({
  email: z.email().transform((e) => e.toLowerCase()),
  name: z.string().trim().min(1).max(80),
  departmentId: z.string().uuid().nullable().optional(),
  roles: z.array(RoleEnum).min(1),
  locale: z.enum(["en", "ms"]).default("en"),
});
export const PatchUserSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  departmentId: z.string().uuid().nullable().optional(),
  roles: z.array(RoleEnum).min(1).optional(),
  active: z.boolean().optional(),
  outOfOffice: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  locale: z.enum(["en", "ms"]).optional(),
});

export const ChangePasswordSchema = z.object({
  current: z.string().min(1),
  next: z.string().min(12, "min12").max(200),
});
export const MyPrefsSchema = z.object({
  locale: z.enum(["en", "ms"]).optional(),
  emailEnabled: z.boolean().optional(),
  outOfOffice: z.boolean().optional(),
});
