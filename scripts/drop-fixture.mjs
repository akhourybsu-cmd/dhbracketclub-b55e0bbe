import { installHomeFixture } from "./dh-home-fixture.mjs";
const picture =
  '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640"><rect width="960" height="640" fill="#244d45"/><path d="M0 500 300 150 600 500 800 300 960 480V640H0" fill="#87aa88"/><circle cx="700" cy="140" r="60" fill="#edcc80"/></svg>';
export async function installDropFixture(page) {
  await installHomeFixture(page);
  await page.route("**/src/integrations/supabase/client.ts*", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "export {supabase} from '/scripts/fixtures/drop-backend.ts';",
    }),
  );
  await page.route("**/src/hooks/useSoundEffect.ts*", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "const play=()=>{};export const useSoundEffect=()=>({play});",
    }),
  );
  await page.route("**/__drop-photo.svg", (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: picture }),
  );
  await page.route("https://img.youtube.com/**", (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: picture }),
  );
  await page.route("https://www.youtube-nocookie.com/embed/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><title>Isolated video player</title><body style="background:#172b27;color:white">Video player</body>',
    }),
  );
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.dropClipboard = text;
        },
      },
    });
  });
}
