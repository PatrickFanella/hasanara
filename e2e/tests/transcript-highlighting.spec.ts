import { expect, test } from "@playwright/test";

test("the spoken-text sweep finishes the first line before starting the next", async ({
  page,
}) => {
  // Use the application's stylesheet without requiring a player or live API.
  await page.route("**/highlight-fixture", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><script type="module">import '/src/index.css';</script></head>
      <body><article class="transcript-document" data-progress="on"
        style="--color-accent: #ff0000; --color-ink: #000000; background: white; width: 240px; font: 20px/40px monospace;">
        <span class="transcript-sentence transcript-sentence-current"
          style="--sweep: 25%; transition: none;">MMMMMMMMMM MMMMMMMMMM MMMMMMMMMM MMMMMMMMMM</span>
      </article></body></html>`,
    }),
  );
  await page.goto("/highlight-fixture");
  const sentence = page.locator(".transcript-sentence");
  await expect(sentence).toHaveCSS("background-clip", "text");
  const lines = await sentence.evaluate((element) =>
    Array.from(element.getClientRects(), ({ left, top, width, height }) => ({
      left,
      top,
      width,
      height,
    })),
  );
  expect(lines).toHaveLength(4);

  // Inspect the rendered pixels: bright red is spoken, darker red is upcoming.
  // A cloned gradient incorrectly paints bright red on all four rows at 25%.
  const screenshot = await page.screenshot({ scale: "css" });
  const spokenPixels = await page.evaluate(
    async ({ png, lines }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${png}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      return lines.map(({ left, top, width, height }) => {
        const { data } = context.getImageData(
          Math.floor(left),
          Math.floor(top),
          Math.ceil(width),
          Math.ceil(height),
        );
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] > 230 && data[i + 1] < 30 && data[i + 2] < 30) count += 1;
        }
        return count;
      });
    },
    { png: screenshot.toString("base64"), lines },
  );
  expect(spokenPixels[0]).toBeGreaterThan(100);
  expect(spokenPixels.slice(1)).toEqual([0, 0, 0]);
});
