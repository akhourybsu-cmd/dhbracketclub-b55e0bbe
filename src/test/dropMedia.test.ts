import { dropVideoSource, socialEmbed } from "@/lib/dropMedia";
import {
  getDropPlayback,
  pauseDropPlayback,
  requestDropPlayback,
  stopDropPlayback,
  subscribeDropPlayback,
} from "@/lib/dropPlayback";

describe("Drop media sources", () => {
  it("uses official providers, never hostname lookalikes or URL fragments", () => {
    expect(socialEmbed("https://www.tiktok.com/@club/video/123456")).toEqual({
      provider: "TikTok",
      src: "https://www.tiktok.com/embed/v2/123456",
      tall: true,
    });
    expect(socialEmbed("https://nottiktok.com/@club/video/123456")).toBeNull();
    expect(
      socialEmbed("https://tiktok.com.attacker.example/@club/video/123456"),
    ).toBeNull();
    expect(
      dropVideoSource(
        "https://example.com/?video=https://youtube.com/watch?v=abcdefghijk",
      ),
    ).toBeNull();
    expect(dropVideoSource("javascript:alert(1)")).toBeNull();
    expect(
      dropVideoSource("https://user:password@youtube.com/watch?v=abcdefghijk"),
    ).toBeNull();
  });
  it("normalizes YouTube watch, short and shared URLs", () => {
    for (const url of [
      "https://youtu.be/abcdefghijk?t=20",
      "https://www.youtube.com/watch?v=abcdefghijk",
      "https://m.youtube.com/embed/abcdefghijk",
    ]) {
      const source = dropVideoSource(url)!;
      expect(source.src).toBe(
        "https://www.youtube-nocookie.com/embed/abcdefghijk?autoplay=1&rel=0&playsinline=1",
      );
      expect(source.kind).toBe("iframe");
      expect(source.tall).toBe(false);
    }
    expect(
      dropVideoSource("https://youtube.com/shorts/abcdefghijk")?.tall,
    ).toBe(true);
    expect(dropVideoSource("https://youtube.com/watch?v=bad")).toBeNull();
  });
  it("keeps native videos and their signed query strings intact", () => {
    const url = "https://media.example/video.MP4?token=sample";
    expect(dropVideoSource(url)).toEqual({
      provider: "Video",
      src: url,
      tall: false,
      kind: "native",
    });
    expect(dropVideoSource("https://media.example/clip.webm")?.kind).toBe(
      "native",
    );
    expect(dropVideoSource("https://media.example/clip.mp4.jpg")).toBeNull();
  });
});

describe("Drop playback ownership", () => {
  afterEach(() => pauseDropPlayback());
  it("has one active player and ignores cleanup from a previous player", () => {
    const listener = vi.fn(),
      unsubscribe = subscribeDropPlayback(listener);
    requestDropPlayback("first");
    requestDropPlayback("second");
    stopDropPlayback("first");
    expect(getDropPlayback()).toBe("second");
    expect(listener).toHaveBeenCalledTimes(2);
    pauseDropPlayback();
    expect(getDropPlayback()).toBeNull();
    unsubscribe();
    requestDropPlayback("third");
    expect(listener).toHaveBeenCalledTimes(3);
  });
});
