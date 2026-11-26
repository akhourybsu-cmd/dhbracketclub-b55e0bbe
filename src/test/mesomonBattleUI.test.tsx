import { useCallback, useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BattlePanel } from "@/components/mesomon/BattlePanel";
import { createBattle, makeCompanion, startBattleTurn } from "@/lib/mesomon/battle";
import { advanceBattleBeat, battleBeatDuration } from "@/lib/mesomon/battlePlayback";
import { createNewSave } from "@/lib/mesomon/engine";
import type { BattleState, MesomonSaveV1 } from "@/lib/mesomon/types";

afterEach(() => { cleanup(); vi.useRealTimers(); });

function Harness({ initial, save, paused = false, onContinue = () => {} }: {
  initial: BattleState; save: MesomonSaveV1; paused?: boolean; onContinue?: () => void;
}) {
  const [battle, setBattle] = useState(initial);
  const onBeat = useCallback((turn: number, index: number) => {
    setBattle(previous => advanceBattleBeat(previous, turn, index));
  }, []);
  return <BattlePanel battle={battle} save={save} paused={paused} onBeat={onBeat} onContinue={onContinue}
    onAction={action => setBattle(previous => startBattleTurn(previous, action, { tinctures: 1 }))} />;
}

describe("battle turn controls", () => {
  it("shows each attacker and only the HP loss from the current impact", () => {
    vi.useFakeTimers();
    const save = createNewSave();
    const battle = createBattle([makeCompanion("rillik")], "tressel");
    battle.allies[0].agility = 100;
    const move = { type: "move", moveId: "brine-snap" } as const;
    const committed = startBattleTurn(battle, move, {});
    render(<Harness initial={battle} save={save} />);
    fireEvent.click(screen.getByRole("button", { name: /Brine Snap/ }));
    expect(screen.queryByRole("button", { name: /Brine Snap/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Next" })).toHaveFocus();
    for (const beat of committed.playback!.beats) {
      expect(screen.getByRole("status")).toHaveTextContent(beat.text);
      expect(screen.getByRole("meter", { name: "Rillik HP" })).toHaveAttribute("aria-valuenow", String(beat.allyVitality[0]));
      expect(screen.getByRole("meter", { name: "Tressel HP" })).toHaveAttribute("aria-valuenow", String(beat.enemyVitality));
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
    }
    expect(screen.getByRole("button", { name: /Brine Snap/ })).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("Turn 2");
  });

  it("moves keyboard focus across and down the same command grid used by touch", () => {
    const battle = createBattle([makeCompanion("rillik")], "tressel");
    render(<Harness initial={battle} save={createNewSave()} />);
    const moves = screen.getAllByRole("button").filter(button => button.closest(".mm-moves"));
    moves.forEach((button, index) => {
      const position = { left: 44 * (index % 2), top: 70 + 44 * Math.floor(index / 2), width: 44, height: 44 };
      vi.spyOn(button, "getBoundingClientRect").mockReturnValue(position as DOMRect);
    });
    expect(moves[0]).toHaveFocus();
    fireEvent.keyDown(moves[0], { key: "ArrowRight" });
    expect(moves[1]).toHaveFocus();
    fireEvent.keyDown(moves[1], { key: "s" });
    expect(moves[3]).toHaveFocus();
    fireEvent.click(moves[3]);
    expect(screen.getByRole("status")).toHaveTextContent(/Tidal Veil/);
  });

  it("keeps the final impact separate from the result and hides both while the winning move starts", () => {
    vi.useFakeTimers();
    const save = createNewSave();
    const battle = createBattle([makeCompanion("rillik")], "rift-wretch", "chamber-boss");
    battle.stability = 1;
    const onContinue = vi.fn();
    render(<Harness initial={battle} save={save} onContinue={onContinue} />);
    fireEvent.click(screen.getByRole("button", { name: /Resonant Cry/ }));
    const bar = screen.getByRole("meter", { name: "Rift Wretch Stability" });
    expect(bar).toHaveAttribute("aria-valuenow", "1");
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("status")).toHaveTextContent(/loses 1 stability/);
    expect(bar).toHaveAttribute("aria-valuenow", "0");
    expect(screen.queryByRole("heading")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: /Pushed back/ })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it.each(["fast", "normal"] as const)("pauses and resumes the same %s beat in reduced motion", speed => {
    vi.useFakeTimers();
    const save = createNewSave();
    save.settings = { ...save.settings, battleSpeed: speed, reducedMotion: true };
    const battle = startBattleTurn(createBattle([makeCompanion("rillik")], "muddren"), { type: "guard" }, {});
    const [first, second] = battle.playback!.beats;
    const duration = battleBeatDuration(battle, speed);
    const panel = render(<Harness initial={battle} save={save} />);
    act(() => vi.advanceTimersByTime(duration - 1));
    expect(screen.getByRole("status")).toHaveTextContent(first.text);
    panel.rerender(<Harness initial={battle} save={save} paused />);
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(first.text);
    panel.rerender(<Harness initial={battle} save={save} />);
    act(() => vi.advanceTimersByTime(duration));
    expect(screen.getByRole("status")).toHaveTextContent(second.text);
    expect(screen.getByRole("status").closest("[data-motion]")).toHaveAttribute("data-motion", "reduced");
  });
});
