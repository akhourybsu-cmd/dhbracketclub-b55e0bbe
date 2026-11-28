import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import "./pocketLaunchLink.css";

export function PocketLaunchLink() {
  const link = useRef<HTMLAnchorElement>(null);
  const location = useLocation();
  useEffect(() => {
    if (location.state?.focusPocketLauncher) link.current?.focus({ preventScroll: true });
  }, [location.key, location.state]);
  return (
    <Link ref={link} to="/dh-pocket" className="home-pocket-key">
      <svg
        className="home-pocket-glyph"
        viewBox="0 0 30 38"
        width="30"
        height="38"
        shapeRendering="crispEdges"
        aria-hidden="true"
        focusable="false"
      >
        <path fill="#0b1918" d="M3 0h22v2h2v30h-2v3h-3v2H2v-2H0V2h3z" />
        <path fill="#9eb4a3" d="M3 2h21v1h1v28h-2v3h-3v1H3V2z" />
        <path fill="#d5ddbb" d="M3 2h21v2H5v29H3z" />
        <path fill="#344947" d="M6 5h16v13h-2v2H6z" />
        <path fill="#98bd86" d="M8 7h12v9H8z" />
        <path fill="#507959" d="M8 13h2v-2h2v2h2v-3h2v2h2v2h2v2H8z" />
        <path fill="#e3ebba" d="M16 8h2v2h-2z" />
        <path fill="#293a39" d="M8 22h3v3h3v3h-3v3H8v-3H5v-3h3z" />
        <path fill="#925344" d="M16 26h3v3h-3zm4-4h3v3h-3z" />
        <path fill="#697f74" d="M15 32h4v1h-4zm5-2h2v1h-2z" />
      </svg>
      <span className="home-pocket-label">
        <span>Launch</span> <strong>DH Pocket</strong>
      </span>
      <span className="home-pocket-play" aria-hidden="true" />
    </Link>
  );
}
