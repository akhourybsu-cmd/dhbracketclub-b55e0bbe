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
function mountNative() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <FindLinkPreview url="https://media.example/club.mp4" />
    </QueryClientProvider>,
  );
  return { ...view, video: view.container.querySelector("video")! };
}
beforeEach(() => {
  watched.length = 0;
  vi.stubGlobal("IntersectionObserver", Observer);
});
afterEach(() => {
  cleanup();
  pauseDropPlayback();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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

it("preserves native pause and seeking without replacing the playing source", () => {
  const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  const { video } = mountNative();
  fireEvent.click(screen.getByRole("button", { name: "Play video" }));
  fireEvent.canPlay(video);
  video.currentTime = 24;
  fireEvent.pause(video);
  expect(video).toHaveAttribute("src", "https://media.example/club.mp4");
  expect(video).toHaveAttribute("controls");
  expect(screen.getByRole("button", { name: "Resume video" })).toBeVisible();
  video.currentTime = 12;
  fireEvent.seeked(video);
  fireEvent.click(screen.getByRole("button", { name: "Resume video" }));
  expect(play).toHaveBeenCalledTimes(2);
  expect(video.currentTime).toBe(12);
  expect(video).toHaveAttribute("src", "https://media.example/club.mp4");
  expect(screen.getByRole("button", { name: "Pause video" })).toBeVisible();
});

it("unloads for another surface and resumes the local bookmark only after another tap", () => {
  const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  const { video } = mountNative();
  vi.spyOn(video, "duration", "get").mockReturnValue(60);
  fireEvent.click(screen.getByRole("button", { name: "Play video" }));
  fireEvent.canPlay(video);
  video.currentTime = 18;
  act(() => pauseDropPlayback());
  expect(video).not.toHaveAttribute("src");
  const resume = screen.getByRole("button", { name: "Resume video" });
  expect(play).toHaveBeenCalledTimes(1);
  fireEvent.click(resume);
  video.currentTime = 0;
  fireEvent.loadedMetadata(video);
  expect(play).toHaveBeenCalledTimes(2);
  expect(video.currentTime).toBe(18);
});

it("ignores a stale rejected play promise after leaving and retrying the same player", async () => {
  let rejectFirst: (error: Error) => void = () => {};
  vi.spyOn(HTMLMediaElement.prototype, "play")
    .mockImplementationOnce(
      () =>
        new Promise<void>((_, reject) => {
          rejectFirst = reject;
        }),
    )
    .mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  const { video } = mountNative();
  fireEvent.click(screen.getByRole("button", { name: "Play video" }));
  act(() => pauseDropPlayback());
  fireEvent.click(screen.getByRole("button", { name: "Play video" }));
  await act(async () => rejectFirst(new Error("Old network attempt")));
  expect(video).toHaveAttribute("src");
  expect(screen.queryByRole("button", { name: "Retry video" })).toBeNull();
  expect(screen.getByRole("button", { name: "Pause video" })).toBeVisible();
});

it("stops media before opening an external source", () => {
  const view = mount();
  fireEvent.click(
    screen.getAllByRole("button", { name: "Play YouTube video" })[0],
  );
  expect(view.container.querySelector("iframe")).toBeTruthy();
  fireEvent.click(screen.getAllByRole("link", { name: "Open on YouTube" })[0]);
  expect(view.container.querySelector("iframe")).toBeNull();
});

it("treats a native pause during a pending play request as a pause, not a failed clip", async () => {
  let rejectPlay: (error: Error) => void = () => {};
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementationOnce(
    () =>
      new Promise<void>((_, reject) => {
        rejectPlay = reject;
      }),
  );
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  const { video } = mountNative();
  fireEvent.click(screen.getByRole("button", { name: "Play video" }));
  await act(async () =>
    rejectPlay(new DOMException("Interrupted by pause", "AbortError")),
  );
  expect(video).toHaveAttribute("src");
  expect(screen.getByRole("button", { name: "Resume video" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Retry video" })).toBeNull();
});

it("releases a playing native element when its card unmounts", () => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  const pause = vi
    .spyOn(HTMLMediaElement.prototype, "pause")
    .mockImplementation(() => {});
  const load = vi
    .spyOn(HTMLMediaElement.prototype, "load")
    .mockImplementation(() => {});
  const { video, unmount } = mountNative();
  fireEvent.click(screen.getByRole("button", { name: "Play video" }));
  expect(video).toHaveAttribute("src");
  unmount();
  expect(video).not.toHaveAttribute("src");
  expect(pause).toHaveBeenCalled();
  expect(load).toHaveBeenCalled();
});

it("offers a user-gesture retry when the browser blocks native playback", async () => {
  vi.spyOn(HTMLMediaElement.prototype, "play")
    .mockRejectedValueOnce(new DOMException("Tap to play", "NotAllowedError"))
    .mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  const { video } = mountNative();
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Play video" })),
  );
  expect(video).toHaveAttribute("src");
  expect(screen.queryByRole("button", { name: "Retry video" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Play video" }));
  expect(screen.getByRole("button", { name: "Pause video" })).toBeVisible();
});
