import { describe, expect, it } from "vitest";
import { diagnoseEmailByRules } from "./emailDiagnosisRules";

describe("diagnoseEmailByRules", () => {
  it.each([
    ["Fluxo de e-mail recusou (401)", "flow-auth"],
    ["Error 429 too many requests", "rate-limit"],
    ["fetch failed: timeout", "flow-error"],
    ["550 5.1.1 user unknown", "bad-recipient"],
    ["o responsável disse que não chegou nada", "spam"],
    ["M365_FLOW_URL ausente", "flow-not-configured"],
  ])("%s → %s", (text, rule) => {
    expect(diagnoseEmailByRules(text).rule).toBe(rule);
  });
  it("sem padrão conhecido pede mais detalhes", () => {
    const r = diagnoseEmailByRules("algo estranho");
    expect(r.rule).toBeNull();
    expect(r.answer).toContain("Causa provável");
  });
});
