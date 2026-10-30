// Production Rune Delve pages/hooks with isolated identity, transport and audio.
import { installHomeFixture } from "./dh-home-fixture.mjs";
export async function installRuneFixture(page, { showHelp = false } = {}) {
  await installHomeFixture(page);
  const stub = (path, body) =>
    page.route("**/" + path + "*", (route) =>
      route.fulfill({ contentType: "text/javascript", body }),
    );
  await stub(
    "src/integrations/supabase/client.ts",
    "export {supabase} from '/scripts/fixtures/rune-backend.ts';",
  );
  await stub(
    "src/hooks/useSoundEffect.ts",
    "const play=()=>{};export const useSoundEffect=()=>({play,soundEnabled:false,toggleSound:()=>{}});",
  );
  await stub(
    "src/hooks/useRuneDelveSfx.ts",
    "const play=()=>{};export const useRuneDelveSfx=()=>({play,enabled:false});",
  );
  await page.addInitScript((showHelp) => {
    localStorage.setItem("dh-club-sound-enabled", "false");
    localStorage.setItem("dh-club-music-enabled-v1", "false");
    if (showHelp) {
      localStorage.removeItem("rune_delve_seen_help_v2");
      localStorage.removeItem("rd-guide-v1:member");
    } else {
      localStorage.setItem("rune_delve_seen_help_v2", "1");
      localStorage.setItem("rd-guide-v1:member", "1");
    }
    localStorage.setItem("rd-control-mode-v1", "tap");
  }, showHelp);
}
