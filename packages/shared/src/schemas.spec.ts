import { describe, expect, it } from "vitest";
import { CreateComplaintSchema, TriageDecisionSchema, VerifySchema } from "./schemas";

const valid = {
  type: "CORRECTIVE", source: "CUSTOMER", process: "POWDER_COATING", priority: "HIGH",
  customerName: "Syarikat Maju", poDoNumber: "DO-1", quantity: 20, quantityUnit: "PCS",
  description: "Customer received 20 brackets with the powder coat peeling along the folded edge of each part.",
};

describe("CreateComplaintSchema", () => {
  it("accepts a complete customer complaint and defaults attachmentIds", () => {
    const r = CreateComplaintSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.attachmentIds).toEqual([]);
  });
  it("requires customer name when the source is a customer", () => {
    const r = CreateComplaintSchema.safeParse({ ...valid, customerName: undefined });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path.join("."))).toContain("customerName");
  });
  it("requires supplier name only for supplier sources", () => {
    expect(CreateComplaintSchema.safeParse({ ...valid, source: "SUPPLIER", customerName: undefined }).success).toBe(false);
    expect(CreateComplaintSchema.safeParse({ ...valid, source: "SUPPLIER", customerName: undefined, supplierName: "ABC" }).success).toBe(true);
  });
  it("requires the free-text field when Other is chosen", () => {
    expect(CreateComplaintSchema.safeParse({ ...valid, process: "OTHER" }).success).toBe(false);
    expect(CreateComplaintSchema.safeParse({ ...valid, process: "OTHER", processOther: "Packing" }).success).toBe(true);
  });
  it("rejects a description under 50 characters with the min50 message", () => {
    const r = CreateComplaintSchema.safeParse({ ...valid, description: "too short" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.find((i) => i.path[0] === "description")?.message).toBe("min50");
  });
});

describe("TriageDecisionSchema", () => {
  it("accept needs department and assignee", () => {
    expect(TriageDecisionSchema.safeParse({ decision: "ACCEPT", priority: "HIGH" }).success).toBe(false);
    expect(TriageDecisionSchema.safeParse({ decision: "ACCEPT", priority: "HIGH", departmentId: "5f3e0b4e-1c7c-4c8a-9a3e-2f9d2d8a1b11", assigneeId: "5f3e0b4e-1c7c-4c8a-9a3e-2f9d2d8a1b12" }).success).toBe(true);
  });
  it("reject needs a reason text", () => {
    expect(TriageDecisionSchema.safeParse({ decision: "REJECT", reason: "NOT_NC", reasonText: "" }).success).toBe(false);
  });
});

describe("VerifySchema", () => {
  it("satisfactory needs at least one disposition", () => {
    expect(VerifySchema.safeParse({ result: "SATISFACTORY", dispositions: [], qaJustification: "ok" }).success).toBe(false);
    expect(VerifySchema.safeParse({ result: "SATISFACTORY", dispositions: ["REWORK_INTERNAL"], qaJustification: "ok" }).success).toBe(true);
  });
  it("non-satisfactory needs a return reason", () => {
    expect(VerifySchema.safeParse({ result: "NON_SATISFACTORY", qaJustification: "x" }).success).toBe(false);
  });
});
