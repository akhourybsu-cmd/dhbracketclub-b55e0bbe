import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import {
  ALL_NAV_ITEMS,
  getRouteTitle,
  pickMostUsedTabs,
} from "@/lib/appNavigation";
import { getOnboarding } from "@/lib/onboarding/registry";
import { ONBOARDING_ICONS } from "@/lib/onboarding/icons";
import { NAV_ASSET_SLUGS } from "@/types/assets";
import { getAppScrollTop } from "@/lib/appScroll";
import { BottomTabBar } from "@/components/BottomTabBar";

const settings = vi.hoisted(() => ({ reducedMotion: false }));
vi.mock("@/hooks/useSoundEffect", () => ({
  useSoundEffect: () => ({ play: vi.fn() }),
}));
vi.mock("framer-motion", () => ({
  useReducedMotion: () => settings.reducedMotion,
  motion: {
    span: ({
      layoutId: _layoutId,
      transition: _transition,
      ...props
    }: React.HTMLAttributes<HTMLSpanElement> & {
      layoutId?: string;
      transition?: unknown;
    }) => React.createElement("span", props),
  },
}));

const appSource = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
const routes = new Set(
  [...appSource.matchAll(/<Route\s+path="([^"]+)"/g)].map((match) => match[1]),
);
const onboardings = [...new Set(Object.values(NAV_ASSET_SLUGS))].flatMap(
  (slug) => {
    const onboarding = getOnboarding(slug);
    return onboarding ? [onboarding] : [];
  },
);
const bodyScroll = vi.fn();
const rootScroll = vi.fn();
const windowScroll = vi.fn();

beforeEach(() => {
  settings.reducedMotion = false;
  bodyScroll.mockReset();
  rootScroll.mockReset();
  windowScroll.mockReset();
  vi.spyOn(window, "scrollTo").mockImplementation(windowScroll);
  Object.defineProperty(document.body, "scrollTo", {
    configurable: true,
    value: bodyScroll,
  });
  Object.defineProperty(document.documentElement, "scrollTo", {
    configurable: true,
    value: rootScroll,
  });
  document.body.scrollTop = 0;
  document.documentElement.scrollTop = 0;
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Location() {
  return React.createElement(
    "output",
    { "data-testid": "current-route" },
    useLocation().pathname,
  );
}
function renderNavigation() {
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: ["/finds"] },
      React.createElement(BottomTabBar, {
        items: pickMostUsedTabs({}, ALL_NAV_ITEMS),
        onOpenMore: vi.fn(),
      }),
      React.createElement(Location),
    ),
  );
}

describe("visual entry points stay connected", () => {
  it("connects every shared destination and registered tutorial CTA to an app route", () => {
    const destinations = [
      ...ALL_NAV_ITEMS.map((item) => item.path),
      ...onboardings.map((onboarding) => onboarding.primaryCta.route),
    ];
    expect(destinations.filter((path) => !routes.has(path))).toEqual([]);
  });

  it("provides a feature title for every shared destination and supported settings alias", () => {
    expect(
      ALL_NAV_ITEMS.filter((item) => getRouteTitle(item.path) === "DH Club"),
    ).toEqual([]);
    expect(getRouteTitle("/lockbox/a-lock")).toBe("Lockbox");
    expect(getRouteTitle("/narrative/a-campaign")).toBe("Narrative RPG");
    expect(getRouteTitle("/clubs/my-club/settings")).toBe("Club Settings");
    expect(getRouteTitle("/posts/create")).toBe("Discussions");
  });

  it("resolves every registered header and tutorial-step icon in both tour consumers", () => {
    const keys = onboardings
      .flatMap((onboarding) => [
        onboarding.iconKey,
        ...onboarding.onboardingSteps.map((step) => step.iconKey),
      ])
      .filter((key): key is string => Boolean(key));
    expect([...new Set(keys)].filter((key) => !ONBOARDING_ICONS[key])).toEqual(
      [],
    );
  });

  it("returns the actual body-scrolled feed to the top when its active tab is tapped", () => {
    document.body.scrollTop = 840;
    expect(getAppScrollTop()).toBe(840);
    renderNavigation();
    fireEvent.click(screen.getByRole("button", { name: "The Drop" }));
    expect(bodyScroll).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    expect(rootScroll).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    expect(windowScroll).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    expect(screen.getByTestId("current-route")).toHaveTextContent("/finds");
  });

  it("uses an immediate scroll with reduced motion and keeps another destination navigable", () => {
    settings.reducedMotion = true;
    renderNavigation();
    fireEvent.click(screen.getByRole("button", { name: "The Drop" }));
    expect(bodyScroll).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
    fireEvent.click(screen.getByRole("button", { name: "Chat" }));
    expect(screen.getByTestId("current-route")).toHaveTextContent("/chat");
  });
});
