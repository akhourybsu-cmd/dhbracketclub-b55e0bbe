import React from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

const requests = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: requests }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "player" } }),
}));

import { useUnlockRelic, useUpgradeRelic } from "@/hooks/useRelicCollection";

afterEach(cleanup);

describe("legacy relic mutation boundaries", () => {
  it("cannot grant or upgrade a relic through direct client writes", async () => {
    const client = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => ({
        unlock: useUnlockRelic(),
        upgrade: useUpgradeRelic(),
      }),
      { wrapper },
    );
    await act(async () => {
      await expect(
        result.current.unlock.mutateAsync({
          relic_id: "phoenix_heart",
          level: 1,
        }),
      ).rejects.toThrow("managed by the server");
      await expect(
        result.current.upgrade.mutateAsync({
          relic_id: "ember_edge",
          expected_rank: 1,
        }),
      ).rejects.toThrow("Armory");
    });
    expect(requests.from).not.toHaveBeenCalled();
    expect(requests.rpc).not.toHaveBeenCalled();
  });
});
