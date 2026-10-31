import { useState } from "react";
import {
  DoorOpen,
  Footprints,
  Gem,
  Compass,
  KeyRound,
  Orbit,
  RotateCcw,
  Snowflake,
  ToggleLeft,
} from "lucide-react";
import { RunePager } from "./RunePager";
import { RuneSigil } from "./RuneSigil";
import "./runePuzzleFrame.css";

const PAGES = [
  {
    title: "Learn. Practice. Trial.",
    icon: Compass,
    text: "Your first chamber teaches each action. Practice asks you to find a route. The Trial leaves the choices to you.",
    example:
      "Play solo whenever you like. Guidance and free hints are always in reach.",
  },
  {
    title: "One step. A new possibility.",
    icon: Footprints,
    text: "Tap a neighbouring tile or use the arrow keys. Push a runestone by standing behind it.",
    example: "Stones move one at a time. Pulling is not possible.",
  },
  {
    title: "Restore the chamber",
    icon: DoorOpen,
    text: "Place runestones on their matching sigils, then walk into the portal.",
    example: "The symbol on each stone matches its destination.",
  },
  {
    title: "Experiment freely",
    icon: RotateCcw,
    text: "Undo, restart, or ask for a hint while exploring. None cost anything.",
    example: "Efficiency counts pushes first. Take your time walking.",
  },
  {
    title: "Hold the way open",
    icon: ToggleLeft,
    text: "The delver or a stone can press a plate to open the gates.",
    example: "An occupied gate stays open until its tile is vacated.",
  },
  {
    title: "Read the ice",
    icon: Snowflake,
    text: "Pushed stones slide across ice until they leave it or meet an obstacle.",
    example: "Your delver still moves one tile at a time.",
  },
  {
    title: "Seek the secret",
    icon: Gem,
    text: "Treasure is optional. Restore a guardian’s matching sigils to calm its ward.",
    example:
      "Earn a star for escaping, one for efficient pushes, and one for all the treasure.",
  },
  {
    title: "Beyond one room",
    icon: Compass,
    text: "Step through a doorway to discover another room. Every room stays as you left it.",
    example:
      "Only your delver travels. The map records places you have explored.",
  },
  {
    title: "Bring discoveries back",
    icon: KeyRound,
    text: "Walk over a colored key to open its matching locks across the whole chamber.",
    example:
      "Keys are reusable. An earlier room can hold a newly opened route.",
  },
  {
    title: "Find a new approach",
    icon: Orbit,
    text: "A rift carries your delver to its pair. Use it to reach a new pushing position.",
    example:
      "Runestones cannot enter doorways or rifts. Undo still works across rooms.",
  },
];

export function RunePuzzleGuide() {
  const [page, setPage] = useState(0);
  const entry = PAGES[page];
  const Icon = entry.icon;
  return (
    <div className="rd-puzzle-guide">
      <article
        className="rd-puzzle-guide-card rd-menu-content-enter"
        key={page}
      >
        <Icon size={44} aria-hidden="true" />
        <div className="rd-puzzle-guide-sigils" aria-hidden="true">
          {(["red", "blue", "green", "gold"] as const).map((type) => (
            <RuneSigil key={type} type={type} />
          ))}
        </div>
        <h3 className="rd-title">{entry.title}</h3>
        <p>{entry.text}</p>
        <small>{entry.example}</small>
      </article>
      <RunePager
        page={page}
        pageCount={PAGES.length}
        onPageChange={setPage}
        label="Puzzle guide"
      />
    </div>
  );
}
