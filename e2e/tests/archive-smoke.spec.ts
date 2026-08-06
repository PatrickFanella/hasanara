import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const seededVideo = {
  id: "00000000-0000-0000-0000-000000000201",
  youtube_id: "seeded-video",
  title: "Seeded archive episode",
  duration_seconds: 3661,
  state: "completed",
  uploaded_at: "2026-06-15T12:00:00Z",
  channel_name: "HasanAbi",
};

async function seedArchiveApi(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const respond = (body: unknown) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });

    if (url.pathname === "/api/auth/me") return respond({ user: null });
    if (url.pathname === "/api/archive/summary") {
      return respond({
        creator_name: "HasanAbi",
        video_count: 1,
        total_duration_seconds: 3661,
        transcript_word_count: 4200,
        updated_at: "2026-06-16T00:00:00Z",
        recent_videos: [seededVideo],
        popular_searches: [{ term: "labor", frequency: 12 }],
      });
    }
    if (url.pathname === "/api/archive/timeline") {
      return respond({
        buckets: [
          {
            period: "2026-06",
            label: "June 2026",
            video_count: 1,
            total_duration_seconds: 3661,
            videos: [seededVideo],
          },
        ],
      });
    }
    if (url.pathname === "/api/archive/intelligence") {
      const selectedPeriod = {
        slug: "2026-06",
        label: "June 2026",
        kind: "month",
        date_from: "2026-06-01",
        date_to: "2026-06-30",
        description: "A seeded public archive window.",
        video_count: 1,
        total_duration_seconds: 3661,
      };
      return respond({
        summary: {
          creator_name: "HasanAbi",
          video_count: 1,
          total_duration_seconds: 3661,
          transcript_word_count: 4200,
          recent_videos: [seededVideo],
          popular_searches: [],
        },
        exploration_modes: ["timeline", "topics", "trending", "suggested"],
        trending_searches: [],
        suggested_searches: [],
        people: [],
        tags: [],
        topic_cards: [],
        periods: [
          {
            period: selectedPeriod.slug,
            label: selectedPeriod.label,
            video_count: 1,
            total_duration_seconds: 3661,
            videos: [seededVideo],
            top_topics: [],
            evidence: [],
            summary: selectedPeriod.description,
          },
        ],
        selected_period: selectedPeriod,
        period_options: [selectedPeriod],
      });
    }
    if (url.pathname === "/api/search/grouped") {
      return respond({
        total_moments: 1,
        total_videos: 1,
        groups: [
          {
            video: seededVideo,
            moments: [
              {
                id: 1,
                video_id: seededVideo.id,
                start_ms: 12000,
                end_ms: 18000,
                snippet: "labor rights",
                source: "whisper",
              },
            ],
          },
        ],
      });
    }
    if (url.pathname === "/api/search/suggestions")
      return respond({ suggestions: [] });
    if (url.pathname === "/api/search/mentions/export") {
      return respond({
        items: [
          {
            video_id: seededVideo.id,
            video_title: seededVideo.title,
            start_ms: 12000,
            end_ms: 18000,
            snippet: "labor rights",
            source: "whisper",
            deep_link: `/v/${seededVideo.id}?t=12`,
          },
        ],
      });
    }
    if (url.pathname === "/api/search/mention-map") {
      return respond({
        query: "labor",
        total_moments: 1,
        total_videos: 1,
        related_topics: [],
        top_episodes: [],
        top_episodes_count: 0,
      });
    }
    if (url.pathname === "/api/archive/topics/labor/timeline") {
      return respond({
        topic: "labor",
        granularity: "month",
        buckets: [
          {
            period: "2026-06",
            label: "June 2026",
            mention_count: 1,
            episode_count: 1,
            evidence: [
              {
                video: seededVideo,
                start_ms: 12000,
                end_ms: 18000,
                snippet: "labor rights",
              },
            ],
          },
        ],
      });
    }
    if (url.pathname === "/api/archive/topics/labor/opinions") {
      return respond({ items: [] });
    }
    if (url.pathname === "/api/videos") {
      return respond({
        items: [seededVideo],
        page_info: {
          has_next_page: false,
          has_previous_page: false,
          next_cursor: null,
          previous_cursor: null,
          total_count: 1,
        },
      });
    }
    if (url.pathname === `/api/videos/${seededVideo.id}`) {
      return respond({
        ...seededVideo,
        has_whisper_transcript: true,
        has_youtube_transcript: true,
        people: [],
        tags: [],
      });
    }
    if (url.pathname === `/api/videos/${seededVideo.id}/transcript`) {
      return respond({
        video_id: seededVideo.id,
        source: "whisper",
        source_label: "Native transcript",
        segments: [
          {
            start_ms: 12000,
            end_ms: 18000,
            text: "Labor rights are worth protecting.",
            speaker_label: "Hasan",
          },
        ],
        blocks: [
          {
            block_index: 0,
            start_ms: 12000,
            end_ms: 18000,
            speaker_label: "Hasan",
            text: "Labor rights are worth protecting.",
            segment_ids: [0],
            kind: "speaker_turn",
            primary_source: "whisper",
            supporting_sources: ["whisper"],
          },
        ],
      });
    }
    if (url.pathname === `/api/videos/${seededVideo.id}/chapters`) {
      return respond({
        video_id: seededVideo.id,
        chapters: [],
        source: "transcript",
      });
    }
    if (url.pathname === `/api/videos/${seededVideo.id}/related`) {
      return respond({ items: [] });
    }
    if (url.pathname === `/api/videos/${seededVideo.id}/quoted-moments`) {
      return respond({ items: [] });
    }
    if (url.pathname === "/api/events/batch") return respond({ ok: true });
    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: "{}",
    });
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    class Player {
      constructor(
        _element: HTMLElement,
        config: { events: { onReady: () => void } },
      ) {
        queueMicrotask(() => config.events.onReady());
      }
      destroy() {}
      seekTo() {}
      playVideo() {}
      pauseVideo() {}
      getPlayerState() {
        return 0;
      }
      getCurrentTime() {
        return 12;
      }
    }
    (window as typeof window & { YT: { Player: typeof Player } }).YT = {
      Player,
    };
  });
  await seedArchiveApi(page);
});

test("anonymous visitors can search from the populated archive home", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Find the moment. Read the record." }),
  ).toBeVisible();
  await expect(page.getByText("Seeded archive episode").first()).toBeVisible();

  await page.getByLabel("Search the HasanAbi archive").fill("labor rights");
  await page.getByRole("button", { name: "Search archive" }).click();
  await expect(page).toHaveURL(/\/search\?q=labor%20rights$/);
});

test("timeline links preserve the selected archive period", async ({
  page,
}) => {
  await page.goto("/timeline");
  await expect(
    page.getByRole("heading", { name: "Archive chronology" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "June 2026" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Browse this period" }),
  ).toHaveAttribute(
    "href",
    "/episodes?date_from=2026-06-01&date_to=2026-06-30",
  );
});

test("anonymous visitors can browse the seeded VOD library", async ({
  page,
}) => {
  await page.goto("/episodes");
  await expect(page.getByText("Seeded archive episode")).toBeVisible();
  await expect(page.getByText(/1 VOD/)).toBeVisible();
});

test("legacy library and saved links render their current destinations", async ({
  page,
}) => {
  await page.goto("/streams");
  await expect(
    page.getByRole("heading", { name: "Browse HasanAbi VODs" }),
  ).toBeVisible();
  await expect(page.getByText("Seeded archive episode")).toBeVisible();

  await page.goto("/favorites");
  await expect(
    page.getByRole("heading", { name: "Saved moments and searches" }),
  ).toBeVisible();
  await expect(page.getByText("No saved moments yet.")).toBeVisible();
});

test("reduced-motion preference disables nonessential motion and smooth scrolling", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const styles = await page
    .getByRole("button", { name: "Search archive" })
    .evaluate((element) => {
      const control = getComputedStyle(element);
      const root = getComputedStyle(document.documentElement);
      return {
        animationDuration: parseFloat(control.animationDuration),
        animationIterations: control.animationIterationCount,
        scrollBehavior: root.scrollBehavior,
        transitionDuration: parseFloat(control.transitionDuration),
      };
    });

  expect(styles.animationDuration).toBeLessThanOrEqual(0.01);
  expect(styles.animationIterations).toBe("1");
  expect(styles.scrollBehavior).toBe("auto");
  expect(styles.transitionDuration).toBeLessThanOrEqual(0.01);
});

test("every mention can become a persistent in-app playback queue", async ({
  page,
}) => {
  await page.goto("/search?q=labor");
  await page
    .getByRole("button", { name: "Add every mention to queue" })
    .click();
  await expect(page.getByText("Playback queue", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Seeded archive episode at 12s" }),
  ).toBeVisible();
});

test("topic intelligence has accessible timeline evidence and empty opinion state", async ({
  page,
}) => {
  await page.goto("/topics/labor");
  await expect(
    page.getByRole("heading", { name: "Mentions over time" }),
  ).toBeVisible();
  await expect(
    page.getByRole("table", { name: "Accessible topic timeline data" }),
  ).toBeVisible();
  await expect(
    page.getByText("No published opinion history is available."),
  ).toBeVisible();
});

test("visitors can read, save, remove, and reopen a transcript moment", async ({
  page,
}) => {
  await page.goto(`/v/${seededVideo.id}`);
  await expect(
    page.getByRole("heading", { name: seededVideo.title }),
  ).toBeVisible();

  const sentence = page.getByRole("button", {
    name: "Play sentence from 00:00:12",
  });
  await expect(sentence).toContainText("Labor rights are worth protecting.");
  await sentence.click();
  await page.getByRole("button", { name: "Save moment" }).click();
  await expect(page.getByText("Transcript moment saved.")).toBeVisible();

  await page.goto("/saved");
  await expect(
    page.getByText("Labor rights are worth protecting."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Open moment" })).toHaveAttribute(
    "href",
    `/v/${seededVideo.id}?t=12#seg-1`,
  );

  await page.getByRole("link", { name: "Open moment" }).click();
  await sentence.click();
  await page.getByRole("button", { name: "Remove moment" }).click();
  await expect(page.getByText("Transcript moment removed.")).toBeVisible();
});

test("anonymous account access redirects to sign in and unknown routes recover", async ({
  page,
}) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?next=%2Faccount$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Twitch" }),
  ).toBeVisible();

  await page.goto("/not-a-real-route");
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Return home" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("mobile navigation closes after selection and restores focus on Escape", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const menuButton = page.getByRole("button", { name: "Open menu" });
  await menuButton.click();
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", {
      name: "Timeline",
    })
    .click();
  await expect(page).toHaveURL(/\/timeline$/);
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }),
  ).toBeHidden();

  await page.getByRole("button", { name: "Open menu" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
});

test("public route matrix has no serious accessibility or runtime errors", async ({
  page,
}) => {
  const pageErrors: Array<{ url: string; message: string }> = [];
  page.on("pageerror", (error) =>
    pageErrors.push({ url: page.url(), message: error.stack ?? error.message }),
  );
  const routes = [
    "/",
    "/search?q=labor",
    "/explore",
    "/episodes",
    "/streams",
    "/timeline",
    "/topics/labor",
    `/v/${seededVideo.id}`,
    "/login",
    "/saved",
    "/favorites",
    "/admin/dashboard",
    "/not-a-real-route",
  ];

  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      await page.addScriptTag({
        path: path.resolve(
          process.cwd(),
          "../frontend/node_modules/axe-core/axe.min.js",
        ),
      });
      const violations = await page.evaluate(async () => {
        const axe = (
          window as typeof window & {
            axe: {
              run: () => Promise<{
                violations: Array<{
                  id: string;
                  impact: string | null;
                  nodes: Array<{ target: unknown; failureSummary?: string }>;
                }>;
              }>;
            };
          }
        ).axe;
        return (await axe.run()).violations
          .filter(
            (violation) =>
              violation.impact === "critical" || violation.impact === "serious",
          )
          .map((violation) => ({
            id: violation.id,
            nodes: violation.nodes.map((node) => ({
              target: node.target,
              failureSummary: node.failureSummary,
            })),
          }));
      });
      expect(
        violations,
        `${colorScheme} ${route} accessibility violations`,
      ).toEqual([]);
      const currentUrl = page.url();
      expect(
        pageErrors.filter((error) => error.url === currentUrl),
        `${colorScheme} ${route} runtime errors`,
      ).toEqual([]);
      // Firefox reports aborted fetches from the document being replaced by the
      // next page.goto. They belong to the stale URL, not the active route.
      pageErrors.length = 0;
    }
  }
});

test("core public routes do not overflow a 320px viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  for (const route of [
    "/",
    "/search?q=labor",
    "/explore",
    "/episodes",
    `/v/${seededVideo.id}`,
  ]) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(
      dimensions.scrollWidth,
      `${route} horizontal overflow`,
    ).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  }
});
