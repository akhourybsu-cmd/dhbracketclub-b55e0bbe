import { useEffect, useLayoutEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, BookOpen, ChevronRight, Compass, LogOut, Maximize, Minimize,
  PawPrint, Play, Save, Settings,
} from "lucide-react";
import { LocationChart } from "./LocationChart";
import { getBattleBeat } from "@/lib/mesomon/battlePlayback";
import type { MesomonSaveStatus } from "@/hooks/useMesomonSave";
import { MESOMON_ASSETS, portraitUrl } from "@/lib/mesomon/assets";
import { SPECIES } from "@/lib/mesomon/data/species";
import { CHAPTER_TITLE, getHarborNotes, getMap, getObjective, getQuestSteps } from "@/lib/mesomon/engine";
import { isDirection, keyboardAction } from "@/lib/mesomon/input";
import { readingVoice } from "@/lib/mesomon/reading";
import type { useMesomonFullscreen } from "@/lib/mesomon/useMesomonFullscreen";
import type { GameSession, MesomonSettings } from "@/lib/mesomon/types";

const sections = [
  { id: "party", label: "Companions", icon: PawPrint },
  { id: "journal", label: "Journal", icon: BookOpen },
  { id: "chart", label: "Map", icon: Compass },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "save", label: "Save file", icon: Save },
] as const;
export type MenuTab = "start" | (typeof sections)[number]["id"];

interface StartMenuProps {
  tab: MenuTab;
  onTab: (tab: MenuTab) => void;
  session: GameSession;
  playing: boolean;
  saveLabel: string;
  saveStatus: MesomonSaveStatus;
  fullscreen: ReturnType<typeof useMesomonFullscreen>;
  onClose: () => void;
  onSettings: (value: Partial<MesomonSettings>) => void;
  onSave: () => void;
  onExit: () => void;
  onTitle: () => void;
  onRestart: () => void;
  onCompanion: () => void;
}

export function MesomonStartMenu({
  tab, onTab, session, playing, saveLabel, saveStatus, fullscreen,
  onClose, onSettings, onSave, onExit, onTitle, onRestart, onCompanion,
}: StartMenuProps) {
  const dialog = useRef<HTMLElement>(null);
  const lastCommand = useRef("resume");
  useLayoutEffect(() => {
    const selector = tab === "start" ? `[data-command="${lastCommand.current}"]` : "[data-menu-back]";
    dialog.current?.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
    if (tab !== "start") lastCommand.current = tab;
  }, [tab]);

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (!dialog.current || event.altKey || event.ctrlKey || event.metaKey) return;
      const key = event.key.toLowerCase();
      const target = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const back = key === "escape" || key === "x" || key === "b" || key === "backspace";
      if (back || key === "m") {
        event.preventDefault();
        if (event.repeat) return;
        if (key === "m" || tab === "start") onClose();
        else onTab("start");
        return;
      }
      if (key === "z" && target && dialog.current.contains(target) && target.matches("button,a")) {
        event.preventDefault();
        if (!event.repeat) target.click();
        return;
      }
      const action = keyboardAction(event.key);
      if (tab === "start" && ((action && isDirection(action)) || key === "home" || key === "end")) {
        const commands = Array.from(dialog.current.querySelectorAll<HTMLElement>("[data-command]"));
        if (!commands.length) return;
        event.preventDefault();
        const index = target ? Math.max(0, commands.indexOf(target)) : 0;
        let next = index;
        // Resume spans the first row. Every following row holds two commands.
        if (key === "home") next = 0;
        else if (key === "end") next = commands.length - 1;
        else if (action === "up") next = Math.max(0, index - 2);
        else if (action === "down" && index + 2 < commands.length) next = index === 0 ? 1 : index + 2;
        else if (action === "left" && index > 0 && index % 2 === 0) next--;
        else if (action === "right" && index % 2 === 1 && index + 1 < commands.length) next++;
        commands[next].focus();
        return;
      }
      if (key !== "tab") return;
      const nodes = dialog.current.querySelectorAll<HTMLElement>("button:not(:disabled),a[href],input:not(:disabled)");
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && target === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && target === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [tab, onClose, onTab]);

  const s = session.save.settings;
  const harborNotes = tab === "journal" ? getHarborNotes(session.save) : [];
  const battle = session.save.battle;
  const beat = battle && getBattleBeat(battle);
  const title = sections.find(section => section.id === tab)?.label ?? "Start menu";
  return (
    <div className="mm-modal-backdrop">
      <section ref={dialog} className="mm-menu" role="dialog" aria-modal="true" aria-label="Start menu" data-section={tab}>
        <header>
          <h2>{title}</h2>
          {tab !== "start" && (
            <button type="button" className="mm-menu-back" data-menu-back data-mm-action="cancel" onClick={() => onTab("start")}>
              <ArrowLeft size={16} aria-hidden="true" /> Back
            </button>
          )}
        </header>
        <div className="mm-menu-body" data-section={tab} key={tab}>
          {tab === "start" && (
            <>
              <div className="mm-menu-context">
                <img src={MESOMON_ASSETS.fieldcase} width="216" height="90" alt="" />
                <div>
                  <strong>{getMap(session.save).name}</strong>
                  <span>File {session.save.slot} · <span className={`mm-save-status mm-save-${saveStatus}`} role="status">{saveLabel}</span></span>
                </div>
              </div>
              <nav className="mm-start-list" aria-label="Start menu commands">
                <button className="mm-start-command" data-command="resume" onClick={onClose}>
                  <Play aria-hidden="true" size={19} /><span>{playing ? "Resume" : "Back to title"}</span>
                  <ChevronRight aria-hidden="true" size={16} />
                </button>
                {sections.map(({ id, label, icon: Icon }) => (
                  <button className="mm-start-command" data-command={id} key={id} onClick={() => onTab(id)}>
                    <Icon aria-hidden="true" size={19} /><span>{label}</span><ChevronRight aria-hidden="true" size={16} />
                  </button>
                ))}
                <Link className="mm-start-command" data-command="exit" to="/compete" onClick={onExit}>
                  <LogOut aria-hidden="true" size={19} /><span>Exit game</span><ChevronRight aria-hidden="true" size={16} />
                </Link>
              </nav>
            </>
          )}
          {tab === "chart" && <LocationChart save={session.save} />}
          {tab === "party" && (
            <>
              {session.save.party.length > 0 ? (
                session.save.party.map((member) => {
                  const fighterIndex = battle?.allies.findIndex(ally => ally.id === member.id) ?? -1;
                  const vitality = beat?.allyVitality[fighterIndex] ?? battle?.allies[fighterIndex]?.vitality ?? member.vitality;
                  return (
                    <article className="mm-party-member" key={member.id}>
                      <img
                        src={portraitUrl(member.speciesId)}
                        alt={SPECIES[member.speciesId].name}
                      />
                      <div>
                        <h3>
                          {SPECIES[member.speciesId].name}
                          <small>
                            Lv. {member.level} ·{" "}
                            {SPECIES[member.speciesId].affinities.join(" / ")}
                          </small>
                        </h3>
                        <meter
                          min={0}
                          max={member.maxVitality}
                          value={vitality}
                          aria-label={`${SPECIES[member.speciesId].name} vitality`}
                        />
                        <p>
                          {vitality}/{member.maxVitality} Vitality
                        </p>
                        <dl className="mm-individual-stats" aria-label="Battle stats">
                          <div><dt>Attack</dt><dd>{member.power}</dd></div>
                          <div><dt>Defense</dt><dd>{member.guard}</dd></div>
                          <div><dt>Speed</dt><dd>{member.agility}</dd></div>
                          <div><dt>Resonance</dt><dd>{member.resonance}</dd></div>
                        </dl>
                        <p>{SPECIES[member.speciesId].description}</p>
                      </div>
                    </article>
                  );
                })
              ) : (
                <figure className="mm-cuff-study">
                  <img
                    src={MESOMON_ASSETS.fieldcase}
                    alt="A brass cuff and a folded letter tucked into Tavian’s fieldcase"
                  />
                  <figcaption>
                    <strong>Edenite cuff</strong>
                    <span>No bonds yet</span>
                  </figcaption>
                </figure>
              )}
              {playing && !!session.save.party.length && (
                <button onClick={onCompanion}>
                  {session.save.questFlags.companion_released
                    ? "Call Rillik to the crystal"
                    : "Release Rillik beside you"}
                </button>
              )}
            </>
          )}
          {tab === "journal" && (
            <>
              <h3>{CHAPTER_TITLE}</h3>
              <p className="mm-journal-objective">
                {getObjective(session.save)}
              </p>
              <ol className="mm-quest-steps">
                {getQuestSteps(session.save)
                  .filter((step) => step.complete)
                  .map((step) => (
                    <li key={step.id}>
                      <span aria-hidden="true">◆</span>
                      {step.label}
                    </li>
                  ))}
              </ol>
              {harborNotes.length > 0 && (
                <>
                  <h3>On the quay</h3>
                  <ul className="mm-quest-steps">
                    {harborNotes.map((note) => <li key={note}>{note}</li>)}
                  </ul>
                </>
              )}
              <h3>Recent notes</h3>
              <div className="mm-conversation-log">
                {session.save.dialogueHistory.length ? (
                  session.save.dialogueHistory
                    .slice(-32)
                    .map((entry, index) => (
                      <p key={index}>
                        <strong>{readingVoice(entry.speaker).credit}</strong>
                        {entry.text}
                      </p>
                    ))
                ) : (
                  <p>No entries yet.</p>
                )}
              </div>
            </>
          )}
          {tab === "settings" && (
            <>
              {fullscreen.available && (
                <button className="mm-display-toggle" onClick={fullscreen.toggle}>
                  {fullscreen.active ? <Minimize size={16} aria-hidden="true" /> : <Maximize size={16} aria-hidden="true" />}
                  {fullscreen.active ? "Leave full screen" : "Enter full screen"}
                </button>
              )}
              {fullscreen.error && <p role="status">{fullscreen.error}</p>}
              <Setting
                label="Text"
                values={["slow", "normal", "fast"]}
                value={s.textSpeed}
                onChange={(value) =>
                  onSettings({
                    textSpeed: value as MesomonSettings["textSpeed"],
                  })
                }
                labels={["Slow", "Normal", "Instant"]}
              />
              <Setting
                label="Battles"
                values={["normal", "fast"]}
                value={s.battleSpeed}
                onChange={(value) =>
                  onSettings({
                    battleSpeed: value as MesomonSettings["battleSpeed"],
                  })
                }
              />
              <Toggle
                label="Reduced motion"
                checked={s.reducedMotion}
                onChange={(reducedMotion) => onSettings({ reducedMotion })}
              />
              <Toggle
                label="Seal Assist · no timed input"
                checked={s.sealAssist}
                onChange={(sealAssist) => onSettings({ sealAssist })}
              />
              <Toggle
                label="Haptics"
                checked={s.haptics}
                onChange={(haptics) => onSettings({ haptics })}
              />
              <Toggle
                label="Mute"
                checked={s.mute}
                onChange={(mute) => onSettings({ mute })}
              />
              <label className="mm-range">
                Music{" "}
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={s.musicVolume}
                  onChange={(event) =>
                    onSettings({ musicVolume: Number(event.target.value) })
                  }
                />
              </label>
              <label className="mm-range">
                Harbor ambience{" "}
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={s.ambientVolume}
                  onChange={(event) =>
                    onSettings({ ambientVolume: Number(event.target.value) })
                  }
                />
              </label>
            </>
          )}
          {tab === "save" && (
            <>
              <div className="mm-save-file">
                <small>FIELD NOTES · FILE {session.save.slot}</small>
                <h3>{getMap(session.save).name}</h3>
                <p>
                  {Math.floor(session.save.playtimeSeconds / 60)} min ·{" "}
                  {session.save.party.length} {session.save.party.length === 1 ? "companion" : "companions"}
                </p>
              </div>
              <span className={`mm-save-status mm-save-${saveStatus}`} role="status">{saveLabel}</span>
              {playing && (
                <>
                  <button className="mm-primary" onClick={onSave}>Save now</button>
                  <button onClick={onTitle}>Title screen</button>
                  <button className="mm-danger" onClick={onRestart}>Begin this file again</button>
                </>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function Setting({
  label,
  values,
  value,
  onChange,
  labels,
}: {
  label: string;
  values: string[];
  value: string;
  onChange: (value: string) => void;
  labels?: string[];
}) {
  return (
    <fieldset className="mm-setting">
      <legend>{label}</legend>
      <div>
        {values.map((item, index) => (
          <button
            key={item}
            aria-pressed={value === item}
            onClick={() => onChange(item)}
          >
            {labels?.[index] ?? item}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      className="mm-toggle"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span>{label}</span>
      <b>{checked ? "On" : "Off"}</b>
    </button>
  );
}
