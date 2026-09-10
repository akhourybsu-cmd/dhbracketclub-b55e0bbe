import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  GLOBAL_STANDALONE_PICK_JUDGING_RULES,
  buildJudgingSystemPrompt,
} from "@/lib/draft/judgingRules";

const RATE_DRAFT = readFileSync(
  resolve(__dirname, "../../supabase/functions/rate-draft/index.ts"),
  "utf8"
);
const RESOLVE_DISPUTE = readFileSync(
  resolve(__dirname, "../../supabase/functions/resolve-pick-dispute/index.ts"),
  "utf8"
);
const CHECK_PICK = readFileSync(
  resolve(__dirname, "../../supabase/functions/check-draft-pick/index.ts"),
  "utf8"
);

const FORBIDDEN_PHRASES = [
  "fits the board",
  "hurts the board",
  "rounds out the board",
  "fits the theme",
  "breaks the theme",
  "adds synergy",
  "lacks synergy",
  "cohesive collection",
  "cohesive draft",
  "lacks cohesion",
  "redundant with earlier picks",
  "already drafted something similar",
  "this pick hurts the overall draft",
  "weakens the composition",
  "lacks variety",
  "too one-note",
];

describe("GLOBAL_STANDALONE_PICK_JUDGING_RULES", () => {
  it("forbids theme/synergy/composition language explicitly", () => {
    for (const phrase of FORBIDDEN_PHRASES) {
      expect(GLOBAL_STANDALONE_PICK_JUDGING_RULES.toLowerCase()).toContain(
        phrase.toLowerCase()
      );
    }
  });

  it("declares the standalone, in-a-vacuum rule", () => {
    expect(GLOBAL_STANDALONE_PICK_JUDGING_RULES).toMatch(/INDEPENDENTLY/);
    expect(GLOBAL_STANDALONE_PICK_JUDGING_RULES).toMatch(/IN A VACUUM/);
  });

  it("blocks AI Judging Context from switching to themed/team scoring", () => {
    expect(GLOBAL_STANDALONE_PICK_JUDGING_RULES).toMatch(
      /CAN NEVER OVERRIDE THESE RULES/
    );
    expect(GLOBAL_STANDALONE_PICK_JUDGING_RULES).toMatch(
      /commissioner-selected scoring_mode/
    );
  });

  it("defaults to standalone mode in the system prompt", () => {
    const sys = buildJudgingSystemPrompt();
    expect(sys).toMatch(/INDEPENDENTLY and IN A VACUUM/);
    expect(sys).toMatch(/NEVER switch judging into themed, team, or synergy/);
  });
});

describe("Edge function prompts inline the rules", () => {
  it("rate-draft injects the global standalone rules block", () => {
    expect(RATE_DRAFT).toContain("GLOBAL_STANDALONE_PICK_JUDGING_RULES");
    expect(RATE_DRAFT).toContain(
      "GLOBAL STANDALONE PICK JUDGING RULES (NON-NEGOTIABLE)"
    );
  });

  it("resolve-pick-dispute injects the global standalone rules block", () => {
    expect(RESOLVE_DISPUTE).toContain("GLOBAL_STANDALONE_PICK_JUDGING_RULES");
    expect(RESOLVE_DISPUTE).toContain(
      "GLOBAL STANDALONE PICK JUDGING RULES (NON-NEGOTIABLE)"
    );
  });

  it("check-draft-pick injects the standalone relevance rule", () => {
    expect(CHECK_PICK).toContain("STANDALONE_RELEVANCE_RULE");
    expect(CHECK_PICK).toMatch(/Repeating an archetype/);
  });

  it("rate-draft does not use forbidden composition phrases in its prompt body", () => {
    // Rules block intentionally lists these phrases as forbidden. Strip the
    // rules block, then assert the surrounding prompt body doesn't tell the
    // model to evaluate composition/synergy/etc.
    const withoutRules = RATE_DRAFT.replace(
      /GLOBAL_STANDALONE_PICK_JUDGING_RULES = `[\s\S]*?`;/,
      ""
    );
    expect(withoutRules).not.toMatch(/lacks variety/i);
    expect(withoutRules).not.toMatch(/lacks synergy/i);
    expect(withoutRules).not.toMatch(/cohesive collection/i);
    expect(withoutRules).not.toMatch(/rounds out the board/i);
  });

  it("rejects incomplete AI output instead of backfilling zero scores", () => {
    expect(RATE_DRAFT).toContain("validateDraftGradingResults");
    expect(RATE_DRAFT).toContain("No scores were changed; please retry");
    expect(RATE_DRAFT).not.toContain("backfilling empty row");
    expect(RATE_DRAFT).not.toMatch(/total_score:\s*0/);
  });

  it("uses server-owned keys, bounded scores, and atomic persistence", () => {
    expect(RATE_DRAFT).toContain("participant_key");
    expect(RATE_DRAFT).toContain("pick_key");
    expect(RATE_DRAFT).toContain("minimum: 1");
    expect(RATE_DRAFT).toContain("maximum: 10");
    expect(RATE_DRAFT).toContain("replace_draft_results_atomic");
    expect(RATE_DRAFT).not.toMatch(/\.from\("draft_results"\)\.delete\(\)\.eq\("draft_id"/);
  });
});

/**
 * These are illustrative example cases the rules are designed to protect.
 * They document the intended behavior — the model must score each pick
 * INDEPENDENTLY. We assert the rule text covers exactly the failure modes
 * these examples could trigger.
 */
describe("Example scenarios the rules must protect", () => {
  it("Best Mascots: mixed-category picks should not be penalized as off-theme", () => {
    // Topic: Best Mascots — picks: M&Ms, Baby Back Ribs, Geico Gecko,
    // Energizer Bunny, Mayhem. Each is a standalone mascot; none should
    // be flagged for "breaking a mascot theme" or "getting the board back
    // on track".
    expect(GLOBAL_STANDALONE_PICK_JUDGING_RULES).toMatch(/breaks the theme/i);
    expect(GLOBAL_STANDALONE_PICK_JUDGING_RULES).toMatch(/rounds out the board/i);
  });

  it("Most Important Inventions: repeated tech/science picks must not be flagged for redundancy", () => {
    // Topic: Most Important Inventions in Human History — picks: Printing
    // Press, Internet, Antibiotics, Wheel, Steam Engine. Multiple tech/
    // science picks must not be penalized for redundancy or lack of
    // variety — each is a standalone invention.
    expect(GLOBAL_STANDALONE_PICK_JUDGING_RULES).toMatch(
      /redundant with earlier picks/i
    );
    expect(GLOBAL_STANDALONE_PICK_JUDGING_RULES).toMatch(/lacks variety/i);
    expect(GLOBAL_STANDALONE_PICK_JUDGING_RULES).toMatch(
      /Repeating an archetype/i
    );
  });
});
