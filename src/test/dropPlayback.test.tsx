import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FindLinkPreview } from "@/components/dailyFind/FindLinkPreview";
import { pauseDropPlayback } from "@/lib/dropPlayback";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
  },
}));
const watched: Array<{
  callback: IntersectionObserverCallback;
  element?: Element;
}> = [];
class Observer {
  record: { callback: IntersectionObserverCallback; element?: Element };
  constructor(callback: IntersectionObserverCallback) {
    this.record = { callback };
    watched.push(this.record);
  }
  observe(element: Element) {
    this.record.element = element;
    this.record.callback(
      [
        {
          isIntersecting: true,
          intersectionRatio: 1,
          target: element,
        } as IntersectionObserverEntry,
      ],
      this as unknown as IntersectionObserver,
    );
  }
  disconnect() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
}
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <FindLinkPreview url="https://youtu.be/abcdefghijk" />
      <FindLinkPreview url="https://www.youtube.com/watch?v=12345678901" />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  watched.length = 0;
  vi.stubGlobal("IntersectionObserver", Observer);
});
afterEach(() => {
  cleanup();
  pauseDropPlayback();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("loads a single embedded player after a tap and releases it offscreen", () => {
  const view = mount();
  expect(view.container.querySelectorAll("iframe")).toHaveLength(0);
  fireEvent.click(
    screen.getAllByRole("button", { name: "Play YouTube video" })[0],
  );
  expect(view.container.querySelectorAll("iframe")).toHaveLength(1);
  expect(view.container.querySelector("iframe")?.src).toContain("abcdefghijk");
  fireEvent.click(screen.getByRole("button", { name: "Play YouTube video" }));
  expect(view.container.querySelectorAll("iframe")).toHaveLength(1);
  expect(view.container.querySelector("iframe")?.src).toContain("12345678901");
  const frame = view.container.querySelector('[data-playing="true"]')!;
  const record = watched.find((r) => r.element === frame)!;
  act(() =>
    record.callback(
      [
        {
          isIntersecting: false,
          intersectionRatio: 0,
          target: frame,
        } as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    ),
  );
  expect(view.container.querySelectorAll("iframe")).toHaveLength(0);
});

it("stops playback for a sheet or a hidden app", () => {
  const view = mount();
  fireEvent.click(
    screen.getAllByRole("button", { name: "Play YouTube video" })[0],
  );
  act(() => pauseDropPlayback());
  expect(view.container.querySelectorAll("iframe")).toHaveLength(0);
  fireEvent.click(
    screen.getAllByRole("button", { name: "Play YouTube video" })[0],
  );
  const hidden = vi
    .spyOn(document, "visibilityState", "get")
    .mockReturnValue("hidden");
  fireEvent(document, new Event("visibilitychange"));
  expect(view.container.querySelectorAll("iframe")).toHaveLength(0);
  hidden.mockRestore();
});

it("bounds a stalled iframe and preserves a direct source fallback", () => {
  vi.useFakeTimers();
  const view = mount();
  fireEvent.click(
    screen.getAllByRole("button", { name: "Play YouTube video" })[0],
  );
  act(() => vi.advanceTimersByTime(12001));
  expect(view.container.querySelectorAll("iframe")).toHaveLength(0);
  expect(
    screen.getByRole("button", { name: "Retry YouTube video" }),
  ).toBeTruthy();
  expect(
    screen.getAllByRole("link", { name: "Open on YouTube" })[0],
  ).toHaveAttribute("href", "https://youtu.be/abcdefghijk");
});

it("does not time out a loaded player", () => {
  vi.useFakeTimers();
  const view = mount();
  fireEvent.click(
    screen.getAllByRole("button", { name: "Play YouTube video" })[0],
  );
  fireEvent.load(view.container.querySelector("iframe")!);
  act(() => vi.advanceTimersByTime(20000));
  expect(view.container.querySelectorAll("iframe")).toHaveLength(1);
});

it("keeps native video silent until a tap and unloads it when another surface opens", () => {
  const play = vi
    .spyOn(HTMLMediaElement.prototype, "play")
    .mockResolvedValue(undefined);
  const pause = vi
    .spyOn(HTMLMediaElement.prototype, "pause")
    .mockImplementation(() => {});
  const load = vi
    .spyOn(HTMLMediaElement.prototype, "load")
    .mockImplementation(() => {});
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <FindLinkPreview url="https://media.example/club.mp4" />
    </QueryClientProvider>,
  );
  const video = view.container.querySelector("video")!;
  expect(video).not.toHaveAttribute("src");
  expect(video).toHaveAttribute("playsinline");
  expect(play).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Play video" }));
  expect(play).toHaveBeenCalledTimes(1);
  expect(video).toHaveAttribute("controls");
  fireEvent.canPlay(video);
  act(() => pauseDropPlayback());
  expect(pause).toHaveBeenCalled();
  expect(video).not.toHaveAttribute("src");
  expect(load).toHaveBeenCalled();
  play.mockRestore();
  pause.mockRestore();
  load.mockRestore();
});
