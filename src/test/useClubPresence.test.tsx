import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const channel = {
    presenceState: vi.fn(() => ({ member: [{ user_id: "member" }] })),
    track: vi.fn(async () => {}),
    on: vi.fn(),
    subscribe: vi.fn(),
  };
  const client = {
    rest: {},
    rpc: vi.fn(),
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
  };
  return { client, channel };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: mocks.client }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "member" } }) }));
vi.mock("@/contexts/ClubContext", () => ({ useClub: () => ({ club: { id: "club" } }) }));

import { useClubPresence } from "@/hooks/useClubPresence";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.channel.on.mockReturnValue(mocks.channel);
  mocks.channel.subscribe.mockImplementation((callback) => {
    callback("SUBSCRIBED");
    return mocks.channel;
  });
});
afterEach(cleanup);

describe("club presence loading", () => {
  it("keeps the client receiver when loading the verified directory", async () => {
    mocks.client.rpc.mockImplementation(function (this: typeof mocks.client) {
      if (this !== mocks.client || !this.rest) throw new Error("Missing client receiver");
      return Promise.resolve({ data: [{ id: "member", display_name: "Alex", avatar_url: null }], error: null });
    });
    const { result } = renderHook(() => useClubPresence());
    await waitFor(() => expect(result.current.onlineIds.has("member")).toBe(true));
    expect(mocks.client.rpc).toHaveBeenCalledWith("dh_presence_directory", { p_club_id: "club" });
    expect(mocks.channel.track).toHaveBeenCalledWith({ user_id: "member", display_name: "Alex", avatar_url: null });
  });

  it("does not crash the chat if the optional directory call throws", async () => {
    mocks.client.rpc.mockImplementation(() => { throw new Error("Directory unavailable"); });
    const { result, unmount } = renderHook(() => useClubPresence());
    await waitFor(() => expect(mocks.client.rpc).toHaveBeenCalledOnce());
    expect(result.current.users).toEqual([]);
    expect(mocks.channel.track).not.toHaveBeenCalled();
    unmount();
    expect(mocks.client.removeChannel).toHaveBeenCalledWith(mocks.channel);
  });
});