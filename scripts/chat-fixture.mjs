import { installHomeFixture } from "./dh-home-fixture.mjs";
export async function installChatFixture(page) {
  await installHomeFixture(page);
  await page.route("**/src/integrations/supabase/client.ts*", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "export {supabase} from '/scripts/fixtures/chat-backend.ts';",
    }),
  );
  await page.route("**/src/hooks/useSoundEffect.ts*", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "const play=()=>{};export const useSoundEffect=()=>({play});",
    }),
  );
}
