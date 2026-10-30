import { describe, expect, it } from "vitest";
import rawCatalog from "@/lib/feats/catalog.json";
import expeditionCatalog from "@/lib/feats/runeExpeditionCatalog.json";
import {
  dhRank,
  FEAT_CATEGORIES,
  featProgress,
  featActionPath,
  formatFeatValue,
  nextFeats,
  unseenFeats,
} from "@/lib/feats/progression";
import type { FeatBoard, FeatDefinition, FeatUnlock } from "@/lib/feats/types";
const catalog = rawCatalog as FeatDefinition[];
const receipt = (key: string, tier: number, points = 10): FeatUnlock => ({
  feat_key: key,
  tier,
  points,
  target: catalog.find((f) => f.key === key)!.thresholds[tier - 1],
  earned_at: "2026-10-29T12:00:00Z",
  historical: false,
});
describe("DH Feats shared progression", () => {
  it("defines distinct source metrics, increasing targets and positive tier awards across every category", () => {
    expect(catalog).toHaveLength(63);
    expect(new Set(catalog.map((f) => f.key)).size).toBe(63);
    expect(catalog.reduce((n, f) => n + f.thresholds.length, 0)).toBe(314);
    for (const f of catalog) {
      expect(FEAT_CATEGORIES[f.category]).toBeDefined();
      expect(f.points).toHaveLength(f.thresholds.length);
      f.thresholds.forEach((n, i) => {
        expect(n).toBeGreaterThan(i ? f.thresholds[i - 1] : 0);
        expect(f.points[i]).toBeGreaterThan(0);
      });
    }
    expect(new Set(catalog.map((f) => f.category)).size).toBe(18);
  });
  it("adds expedition goals without changing legacy families and links each goal to its game mode", () => {
    const combined = [...catalog, ...expeditionCatalog];
    expect(new Set(combined.map(feat => feat.key)).size).toBe(66);
    expect(combined.reduce((sum, feat) => sum + feat.thresholds.length, 0)).toBe(329);
    for (const feat of expeditionCatalog) {
      expect(featActionPath(feat)).toBe('/rune-delve/expedition');
      expect(feat.thresholds).toHaveLength(feat.points.length);
      expect(feat.category).toBe('rune');
    }
    expect(featActionPath(catalog.find(feat => feat.key === 'rune_level')!)).toBe('/rune-delve');
  });
  it("uses earned receipts for tiers and their immutable point values", () => {
    const f = catalog.find((f) => f.key === "drop_posts")!;
    const p = featProgress(f, 12, [
      receipt(f.key, 1, 7),
      receipt(f.key, 2, 17),
    ]);
    expect(p.index).toBe(2);
    expect(p.target).toBe(20);
    expect(p.points).toBe(40);
    expect(p.earnedPoints).toBe(24);
    expect(p.progress).toBeCloseTo(7 / 15);
  });
  it("keeps an earned tier when its source content is removed", () => {
    const f = catalog[2],
      p = featProgress(f, 0, [receipt(f.key, 1), receipt(f.key, 2)]);
    expect(p.current).toBe(5);
    expect(p.progress).toBe(0);
    expect(p.earned).toBe(2);
  });
  it("handles complete and zero-progress families without invalid ratios", () => {
    for (const f of catalog) {
      const empty = featProgress(f, NaN, []),
        maxed = featProgress(
          f,
          Infinity,
          f.thresholds.map((_, i) => receipt(f.key, i + 1)),
        );
      expect(empty.progress).toBe(0);
      expect(maxed.maxed).toBe(true);
      expect(maxed.progress).toBe(1);
    }
  });
  it("bounds career rank progress at thresholds and after the final rank", () => {
    expect(dhRank(-2).level).toBe(1);
    expect(dhRank(NaN).progress).toBe(0);
    expect(dhRank(249).remaining).toBe(1);
    expect(dhRank(250).name).toBe("Regular");
    expect(dhRank(250).progress).toBe(0);
    expect(dhRank(10000).next).toBeNull();
    expect(dhRank(999999).progress).toBe(1);
  });
  it("formats game dollars, units and large progress consistently", () => {
    expect(formatFeatValue(100000, "money")).toBe("$100,000");
    expect(formatFeatValue(100000, "money", true)).toBe("$100K");
    expect(formatFeatValue(2.5, "miles")).toBe("2.5 mi");
    expect(formatFeatValue(5, "percent")).toBe("5%");
    expect(formatFeatValue(NaN, "count")).toBe("0");
  });
  it("recommends nearby unfinished tiers within the available feature set", () => {
    const f = catalog.find((f) => f.key === "drop_posts")!,
      g = catalog.find((f) => f.key === "pw_profit")!;
    const board = {
      progress: { [f.key]: 19, [g.key]: 10 },
      unlocks: [receipt(f.key, 1), receipt(f.key, 2)],
    } as unknown as FeatBoard;
    expect(nextFeats(board, [g, f]).map((f) => f.key)).toEqual([f.key, g.key]);
    expect(nextFeats(board, [g]).map((f) => f.key)).toEqual([g.key]);
  });
  it("celebrates new receipts while excluding imported or already-viewed achievements", () => {
    const u = receipt("drop_posts", 1),
      board = {
        seen_at: "2026-10-29T11:00:00Z",
        unlocks: [u, { ...u, feat_key: "drop_days", historical: true }],
      } as FeatBoard;
    expect(unseenFeats(board)).toEqual([u]);
    expect(unseenFeats({ ...board, seen_at: u.earned_at })).toEqual([]);
  });
});
