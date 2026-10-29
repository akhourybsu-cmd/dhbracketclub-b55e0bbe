import { useId } from "react";
import { ENEMIES } from "@/lib/nexus/core/catalog";
import { distance, stats } from "@/lib/nexus/core/engine";
import { SYSTEMS } from "@/lib/nexus/core/systems";
import type { CoreRun, CoreScenario } from "@/lib/nexus/core/types";

function hex(radius: number, offset = 0) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (i * Math.PI) / 3 + offset;
    return `${Math.cos(a) * radius},${Math.sin(a) * radius}`;
  }).join(" ");
}

export function CoreArena({
  run,
  scenario,
  showcase = false,
}: {
  run: CoreRun;
  scenario: CoreScenario;
  showcase?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const v = stats(run, scenario);
  const danger = run.hp / v.maxHp < 0.3;
  const target = run.enemies
    .filter((e) => e.hp > 0)
    .sort((a, b) => distance(a) - distance(b))[0];
  const angle = target ? (Math.atan2(target.y, target.x) * 180) / Math.PI : -90;
  return (
    <svg
      viewBox="-500 -500 1000 1000"
      className={`nc-arena ${showcase ? "nc-arena-showcase" : ""}`}
      role="img"
      aria-label={
        showcase
          ? "A nexus core surrounded by approaching enemies"
          : `Battlefield: ${run.enemies.length} enemies approaching your central core. Hull ${Math.ceil(run.hp)} of ${v.maxHp}.`
      }
    >
      <defs>
        <radialGradient id={`${id}bg`}>
          <stop stopColor="hsl(192 55% 12%)" />
          <stop offset="1" stopColor="hsl(218 42% 5%)" />
        </radialGradient>
        <radialGradient id={`${id}glow`}>
          <stop stopColor="hsl(173 95% 66%)" stopOpacity=".28" />
          <stop offset="1" stopColor="hsl(173 95% 66%)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}core`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="hsl(174 100% 87%)" />
          <stop offset="1" stopColor="hsl(185 85% 43%)" />
        </linearGradient>
        <pattern
          id={`${id}grid`}
          width="40"
          height="40"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 40 0 L 0 0 0 40"
            fill="none"
            stroke="hsl(192 45% 50% / .065)"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect
        x="-500"
        y="-500"
        width="1000"
        height="1000"
        fill={`url(#${id}bg)`}
      />
      <rect
        x="-500"
        y="-500"
        width="1000"
        height="1000"
        fill={`url(#${id}grid)`}
      />
      <circle
        r="460"
        fill="none"
        stroke="hsl(190 35% 40% / .2)"
        strokeDasharray="2 14"
      />
      {[145, 335, 430].map((r) => (
        <circle
          key={r}
          r={r}
          fill="none"
          stroke="hsl(190 35% 50% / .1)"
          strokeWidth="1"
        />
      ))}
      {[0, 90, 180, 270].map((a) => (
        <g key={a} transform={`rotate(${a})`}>
          <path
            d="M 365 0 H 450 M 430 -6 V 6"
            stroke="hsl(190 35% 50% / .3)"
            fill="none"
          />
          <path d="M 110 0 H 145" stroke="hsl(190 35% 50% / .15)" />
        </g>
      ))}
      <circle
        r={v.range}
        fill="hsl(174 90% 65% / .025)"
        stroke="hsl(174 90% 65% / .3)"
        strokeDasharray="4 8"
      />
      <text
        x="0"
        y={-v.range - 12}
        className="nc-svg-label"
        textAnchor="middle"
      >
        TARGETING RANGE
      </text>
      {v.slow > 0 && (
        <circle
          r="165"
          fill="hsl(200 95% 70% / .035)"
          stroke="hsl(200 95% 70% / .3)"
          strokeDasharray="10 16"
        />
      )}
      {v.orbit > 0 && (
        <circle
          r={SYSTEMS.orbitalRadius}
          fill="none"
          stroke="hsl(265 95% 78% / .25)"
        />
      )}
      {Array.from({ length: v.orbit }, (_, i) => {
        const a = run.time * 1.8 + (i * Math.PI * 2) / v.orbit;
        return (
          <g
            key={i}
            transform={`translate(${Math.cos(a) * SYSTEMS.orbitalRadius} ${Math.sin(a) * SYSTEMS.orbitalRadius}) rotate(${(a * 180) / Math.PI})`}
          >
            <path d="M-5 -16 L7 0 L-5 16 L-1 0Z" fill="hsl(265 100% 80%)" />
            <circle r="16" fill="hsl(265 100% 80% / .1)" />
          </g>
        );
      })}
      {run.enemies.map((e) => (
        <g key={e.id} transform={`translate(${e.x} ${e.y})`}>
          <circle
            r={e.radius * 2.3}
            fill={ENEMIES[e.kind].color}
            opacity=".06"
          />
          <g transform={`rotate(${(Math.atan2(e.y, e.x) * 180) / Math.PI})`}>
            {e.kind === "runner" ? (
              <path
                d={`M${-e.radius} 0 L${e.radius} ${-e.radius} L${e.radius * 0.3} 0 L${e.radius} ${e.radius}Z`}
                fill={ENEMIES[e.kind].color}
              />
            ) : (
              <polygon
                points={hex(e.radius, e.kind === "swarm" ? 0 : Math.PI / 6)}
                fill={ENEMIES[e.kind].color}
                fillOpacity={e.kind === "boss" ? 0.35 : 0.8}
                stroke={ENEMIES[e.kind].color}
                strokeWidth={e.kind === "boss" ? 3 : 1}
              />
            )}
            {(e.kind === "tank" || e.kind === "boss") && (
              <polygon
                points={hex(e.radius * 0.6)}
                fill="none"
                stroke={ENEMIES[e.kind].color}
                strokeWidth="2"
              />
            )}
            {e.kind === "splitter" && (
              <path
                d="M-5 0H5M0 -5V5"
                stroke="hsl(218 42% 5%)"
                strokeWidth="2"
              />
            )}
          </g>
          {e.hp < e.maxHp && (
            <>
              <rect
                x={-e.radius}
                y={-e.radius - 8}
                width={e.radius * 2}
                height="3"
                rx="1"
                fill="hsl(0 0% 100% / .12)"
              />
              <rect
                x={-e.radius}
                y={-e.radius - 8}
                width={e.radius * 2 * Math.max(0, e.hp / e.maxHp)}
                height="3"
                rx="1"
                fill={ENEMIES[e.kind].color}
              />
            </>
          )}
          {e.kind === "boss" && (
            <text
              y={-e.radius - 15}
              textAnchor="middle"
              className="nc-svg-label"
              fill="hsl(0 92% 68%)"
            >
              SIEGE ENGINE
            </text>
          )}
        </g>
      ))}
      {(run.shells || []).map((p) => (
        <g key={p.id} transform={`translate(${p.x} ${p.y})`}>
          <circle
            r={p.radius}
            fill="hsl(24 100% 65% / .04)"
            stroke="hsl(24 100% 65%)"
            strokeDasharray="6 8"
            opacity={0.35}
          />
          <circle
            r={6 + p.delay * 14}
            fill="none"
            stroke="hsl(24 100% 78%)"
            strokeWidth="2"
          />
          <path d="M-10 0H10M0 -10V10" stroke="hsl(24 100% 75%)" />
        </g>
      ))}
      {run.projectiles.map((p) => {
        const a = Math.atan2(p.y, p.x);
        return (
          <g key={p.id}>
            <line
              x1={p.x - Math.cos(a) * 24}
              y1={p.y - Math.sin(a) * 24}
              x2={p.x}
              y2={p.y}
              stroke={p.critical ? "hsl(42 100% 70%)" : "hsl(173 100% 78%)"}
              strokeWidth={p.critical ? 4 : 2}
              strokeLinecap="round"
            />
            <circle cx={p.x} cy={p.y} r="3" fill="white" />
          </g>
        );
      })}
      <circle r="105" fill={`url(#${id}glow)`} />
      {run.shield > 0 && (
        <circle
          r="49"
          fill="hsl(193 95% 65% / .05)"
          stroke="hsl(193 95% 70%)"
          strokeWidth="2"
          opacity={0.2 + (0.6 * run.shield) / Math.max(1, v.maxShield)}
          strokeDasharray={`${(run.shield / Math.max(1, v.maxShield)) * 308} 308`}
          transform="rotate(-90)"
        />
      )}
      <g className={showcase ? "nc-core-idle" : ""}>
        <polygon
          points={hex(37, Math.PI / 6)}
          fill="hsl(190 45% 12%)"
          stroke={danger ? "hsl(0 95% 70%)" : "hsl(173 90% 68%)"}
          strokeWidth="2"
        />
        <polygon points={hex(27, Math.PI / 6)} fill={`url(#${id}core)`} />
        <polygon points={hex(16, Math.PI / 6)} fill="hsl(190 70% 16%)" />
        <circle r="7" fill="hsl(173 100% 90%)" />
        <g transform={`rotate(${angle})`}>
          <path
            d="M25 -6H45V6H25"
            fill="hsl(193 50% 16%)"
            stroke="hsl(173 100% 80%)"
            strokeWidth="2"
          />
          <path d="M44 -3H50V3H44" fill="hsl(173 100% 85%)" />
        </g>
      </g>
      {run.overdriveTime > 0 && (
        <circle
          r="60"
          fill="none"
          stroke="hsl(42 100% 68%)"
          strokeWidth="2"
          strokeDasharray="8 8"
          transform={`rotate(${run.time * 80})`}
        />
      )}
      {run.effects.map((e) => {
        const life = e.life / e.maxLife;
        if (e.kind === "mortar")
          return (
            <circle
              key={e.id}
              cx={e.x}
              cy={e.y}
              r={(e.value || 85) * (1 - life)}
              fill="hsl(24 100% 65% / .12)"
              stroke="hsl(24 100% 72%)"
              strokeWidth={life * 5}
              opacity={life}
            />
          );
        if (e.kind === "arc")
          return (
            <path
              key={e.id}
              d={`M ${e.fromX || 0} ${e.fromY || 0} L ${((e.fromX || 0) + e.x) / 2 + 8} ${((e.fromY || 0) + e.y) / 2 - 8} L ${e.x} ${e.y}`}
              fill="none"
              stroke="hsl(270 100% 80%)"
              strokeWidth={2 + life * 2}
              opacity={life}
            />
          );
        if (e.kind === "rail")
          return (
            <g key={e.id} opacity={life}>
              <line
                x1="0"
                y1="0"
                x2={e.x}
                y2={e.y}
                stroke="hsl(42 100% 70%)"
                strokeWidth={2 + life * 7}
              />
              <line
                x1="0"
                y1="0"
                x2={e.x}
                y2={e.y}
                stroke="white"
                strokeWidth="2"
              />
            </g>
          );
        if (e.kind === "nova")
          return (
            <circle
              key={e.id}
              r={(1 - life) * 350}
              fill="hsl(173 95% 75% / .03)"
              stroke="hsl(173 95% 75%)"
              strokeWidth={life * 5}
              opacity={life}
            />
          );
        if (e.kind === "shot")
          return (
            <circle
              key={e.id}
              r={40 + (1 - life) * 12}
              fill="none"
              stroke="hsl(173 95% 80%)"
              opacity={life * 0.6}
            />
          );
        return (
          <g key={e.id} transform={`translate(${e.x} ${e.y})`} opacity={life}>
            <circle
              r={(1 - life) * (e.kind === "kill" ? 30 : 16) + 3}
              fill="none"
              stroke={
                e.kind === "breach"
                  ? "hsl(0 95% 70%)"
                  : e.kind === "kill"
                    ? "hsl(42 95% 70%)"
                    : "hsl(173 95% 80%)"
              }
              strokeWidth="2"
            />
            {e.kind === "kill" && (
              <text
                y={-15 - (1 - life) * 25}
                textAnchor="middle"
                fontSize="15"
                fill="hsl(42 95% 70%)"
              >
                +{e.value}
              </text>
            )}
          </g>
        );
      })}
      <text x="0" y="486" textAnchor="middle" className="nc-svg-label">
        {showcase ? "ONE CORE. EVERY DIRECTION." : "AUTONOMOUS DEFENSE · 360°"}
      </text>
    </svg>
  );
}
