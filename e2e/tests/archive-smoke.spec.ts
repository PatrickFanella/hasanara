import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { createHash } from "node:crypto";

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
      if (url.searchParams.get("q") === "no-such-archive-phrase") {
        return respond({ total_moments: 0, total_videos: 0, groups: [] });
      }
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
    if (url.pathname === "/api/search") {
      return respond({
        hits: [
          {
            id: 1,
            video_id: seededVideo.id,
            start_ms: 12000,
            end_ms: 18000,
            snippet: "labor rights",
            source: "whisper",
            highlights: [{ start: 0, end: 5 }],
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

async function installBrowserStubs(page: Page) {
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
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          (window as typeof window & { __copiedText?: string }).__copiedText =
            value;
        },
      },
    });
  });
}

async function minimumTargetSize(page: Page, accessibleName: string) {
  const target = page.getByRole("button", { name: accessibleName });
  await expect(target).toBeVisible();
  const box = await target.boundingBox();
  expect(box, `${accessibleName} target box`).not.toBeNull();
  expect(box?.width, `${accessibleName} target width`).toBeGreaterThanOrEqual(
    43.9,
  );
  expect(box?.height, `${accessibleName} target height`).toBeGreaterThanOrEqual(
    43.9,
  );
}

test.beforeEach(async ({ page }) => {
  await installBrowserStubs(page);
  await seedArchiveApi(page);
});

test("anonymous visitors can search from the populated archive home", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Search the broadcast archive." }),
  ).toBeVisible();
  await expect(page.getByText("Seeded archive episode").first()).toBeVisible();

  await page.getByLabel("Search Transcript Archive").fill("labor rights");
  await page.getByRole("button", { name: "Search archive" }).click();
  await expect(page).toHaveURL(/\/search\?q=labor%20rights$/);
});

test("timeline links preserve the selected archive period", async ({
  page,
}) => {
  await page.goto("/timeline");
  await expect(
    page.getByRole("heading", { name: "Explore the recording archive" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "June 2026" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Browse all VODs in this period" }),
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
    page.getByRole("heading", { name: "Browse recordings" }),
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

test("browser history restores URL-driven research context", async ({
  page,
}) => {
  await page.goto("/search?q=labor");
  await expect(
    page.getByRole("searchbox", { name: "Search query" }),
  ).toHaveValue("labor");
  await expect(page.getByText("labor rights").first()).toBeVisible();

  await page.goto("/timeline");
  await expect(
    page.getByRole("heading", { name: "Explore the recording archive" }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/search\?q=labor$/);
  await expect(
    page.getByRole("searchbox", { name: "Search query" }),
  ).toHaveValue("labor");
  await expect(page.getByText("labor rights").first()).toBeVisible();

  await page.goForward();
  await expect(page).toHaveURL(/\/explore\?kind=month$/);
  await expect(
    page.getByRole("heading", { name: "Explore the recording archive" }),
  ).toBeVisible();
});

test("refresh preserves topic filters and exact transcript deep links", async ({
  page,
}) => {
  await page.goto(
    "/topics/labor?granularity=week&date_from=2026-06-01&date_to=2026-06-30",
  );
  await page.reload();
  await expect(page.getByLabel("Granularity")).toHaveValue("week");
  await expect(page.locator('input[name="date_from"]')).toHaveValue(
    "2026-06-01",
  );
  await expect(page.locator('input[name="date_to"]')).toHaveValue("2026-06-30");

  await page.goto(`/v/${seededVideo.id}?t=12#block-0`);
  await expect(page.locator("#block-0")).toHaveAttribute("data-active", "true");
  await page.reload();
  await expect(page).toHaveURL(
    new RegExp(`/v/${seededVideo.id}\\?t=12#block-0$`),
  );
  await expect(page.locator("#block-0")).toHaveAttribute("data-active", "true");
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
    name: "Open passage at 00:00:12",
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
    `/v/${seededVideo.id}?t=12#moment-12000`,
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
      name: "Explore",
    })
    .click();
  await expect(page).toHaveURL(/\/explore$/);
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }),
  ).toBeHidden();

  await page.getByRole("button", { name: "Open menu" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
});

test("a shared filtered search restores supported state and ignores retired filters", async ({
  browser,
  page,
}) => {
  const sharedPath =
    "/search?q=labor&source=native&category=politics&date_from=2026-06-01&date_to=2026-06-30&min_duration=10&max_duration=90&sort_by=date_desc&video_id=00000000-0000-0000-0000-000000000201&limit=25&offset=25";
  await page.goto(sharedPath);
  await expect(
    page.getByRole("searchbox", { name: "Search query" }),
  ).toHaveValue("labor");

  const recipientContext = await browser.newContext();
  try {
    const recipient = await recipientContext.newPage();
    await installBrowserStubs(recipient);
    await seedArchiveApi(recipient);
    await recipient.goto(page.url());

    expect(recipient.url()).toBe(page.url());
    await expect(
      recipient.getByRole("searchbox", { name: "Search query" }),
    ).toHaveValue("labor");
    await expect(recipient.getByLabel("From", { exact: true })).toHaveValue(
      "2026-06-01",
    );
    await expect(recipient.getByLabel("To", { exact: true })).toHaveValue(
      "2026-06-30",
    );
    await expect(
      recipient.getByLabel("Transcript", { exact: true }),
    ).toHaveCount(0);
    await expect(recipient.getByLabel("Category")).toHaveCount(0);
    await expect(recipient.getByLabel("Minimum seconds")).toHaveCount(0);
    await expect(recipient.getByLabel("Maximum seconds")).toHaveCount(0);
    await expect(recipient.getByLabel("Sort")).toHaveValue("date_desc");
    await expect(recipient.getByText("labor rights").first()).toBeVisible();
  } finally {
    await recipientContext.close();
  }
});

test("keyboard-only visitors can cite, verify, search within, and recover", async ({
  page,
}) => {
  await page.goto("/");
  const homeSearch = page.getByLabel("Search Transcript Archive");
  await homeSearch.focus();
  await page.keyboard.type("labor");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/search\?q=labor$/);

  const copyLink = page.getByRole("button", { name: "Copy link" });
  await copyLink.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("status").filter({ hasText: "Timestamp link copied." }),
  ).toHaveText("Timestamp link copied.");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { __copiedText?: string }).__copiedText,
      ),
    )
    .toContain(`/v/${seededVideo.id}?t=12`);

  const openMoment = page.getByRole("link", { name: "Open moment" });
  await openMoment.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(
    new RegExp(`/v/${seededVideo.id}\\?t=12#moment-12000$`),
  );

  const sentence = page.getByRole("button", {
    name: "Open passage at 00:00:12",
  });
  await sentence.focus();
  await page.keyboard.press("Enter");
  await expect(sentence).toHaveAttribute("data-current-sentence", "true");

  const save = page.getByRole("button", { name: "Save moment" });
  await save.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("status").filter({ hasText: "Transcript moment saved." }),
  ).toHaveText("Transcript moment saved.");

  const copyQuote = page.getByRole("button", { name: "Copy quote" });
  await copyQuote.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("status").filter({ hasText: "Quote copied." }),
  ).toHaveText("Quote copied.");

  const transcriptSearch = page.getByRole("searchbox", {
    name: "Search inside this VOD",
  });
  await transcriptSearch.focus();
  await page.keyboard.type("rights");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\?t=12&q=rights$/);
  await expect(
    page.getByRole("button", { name: "Go to next match" }),
  ).toBeVisible();

  const desktopSearchNavigation = page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Search" });
  if (await desktopSearchNavigation.isVisible()) {
    await desktopSearchNavigation.focus();
  } else {
    const menu = page.getByRole("button", { name: "Open menu" });
    await menu.focus();
    await page.keyboard.press("Enter");
    await page
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByRole("link", { name: "Search" })
      .focus();
  }
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/search$/);
  const query = page.getByRole("searchbox", { name: "Search query" });
  await expect(query).toBeVisible();
  await query.focus();
  await query.pressSequentially("no-such-archive-phrase", { delay: 75 });
  await expect(query).toHaveValue("no-such-archive-phrase");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "No transcript matches" }),
  ).toBeVisible();

  await query.focus();
  await page.keyboard.press("ControlOrMeta+A");
  await query.pressSequentially("labor", { delay: 75 });
  await expect(query).toHaveValue("labor");
  await page.keyboard.press("Enter");
  await expect(page.getByText("labor rights").first()).toBeVisible();
});

test("shell focus and forced-color selected states remain visible", async ({
  page,
}) => {
  await page.goto("/");
  // Tab only after the lazy route renders; otherwise focus can stay on <body>.
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const focusStopCount = (page.viewportSize()?.width ?? 1280) < 1024 ? 3 : 11;
  for (let index = 0; index < focusStopCount; index += 1) {
    await page.keyboard.press("Tab");
    const focusState = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element) return null;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        height: rect.height,
        outlineStyle: style.outlineStyle,
        outlineWidth: parseFloat(style.outlineWidth),
        width: rect.width,
      };
    });
    expect(focusState, `focus stop ${index + 1}`).not.toBeNull();
    expect(focusState?.width, `focus stop ${index + 1} width`).toBeGreaterThan(
      0,
    );
    expect(
      focusState?.height,
      `focus stop ${index + 1} height`,
    ).toBeGreaterThan(0);
    expect(
      focusState?.outlineStyle,
      `focus stop ${index + 1} outline`,
    ).not.toBe("none");
    expect(
      focusState?.outlineWidth,
      `focus stop ${index + 1} outline width`,
    ).toBeGreaterThanOrEqual(2);
  }

  await page.emulateMedia({ forcedColors: "active" });
  await page.goto("/explore");
  expect(
    await page.evaluate(() => matchMedia("(forced-colors: active)").matches),
  ).toBe(true);
  const dates = page.getByRole("button", { name: "Dates" });
  await dates.focus();
  await page.keyboard.press("Enter");
  await expect(dates).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/\/explore\?kind=date$/);

  const selectedState = await dates.evaluate((element) => {
    const style = getComputedStyle(element);
    const button = element.getBoundingClientRect();
    const group = element.parentElement?.getBoundingClientRect();
    return {
      buttonLeft: button.left,
      buttonRight: button.right,
      groupLeft: group?.left ?? 0,
      groupRight: group?.right ?? 0,
      outlineStyle: style.outlineStyle,
      outlineWidth: parseFloat(style.outlineWidth),
    };
  });
  expect(selectedState.outlineStyle).not.toBe("none");
  expect(selectedState.outlineWidth).toBeGreaterThanOrEqual(2);
  expect(selectedState.buttonLeft).toBeGreaterThanOrEqual(
    selectedState.groupLeft - 1,
  );
  expect(selectedState.buttonRight).toBeLessThanOrEqual(
    selectedState.groupRight + 1,
  );
});

test("public thumbnail routes keep CLS within budget as delayed images load", async ({
  page,
  browserName,
}) => {
  await page.addInitScript(() => {
    if (!PerformanceObserver.supportedEntryTypes.includes("layout-shift"))
      return;
    let cumulativeLayoutShift = 0;
    const layoutShifts: Array<{
      sources: string[];
      value: number;
    }> = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & {
          hadRecentInput: boolean;
          sources?: Array<{ node?: Node | null }>;
          value: number;
        };
        if (!shift.hadRecentInput) {
          cumulativeLayoutShift += shift.value;
          layoutShifts.push({
            value: shift.value,
            sources: (shift.sources ?? []).map((source) => {
              const node = source.node;
              if (!(node instanceof Element))
                return node?.nodeName ?? "unknown";
              const identity = [
                node.tagName.toLowerCase(),
                node.id ? `#${node.id}` : "",
                ...Array.from(node.classList)
                  .slice(0, 2)
                  .map((name) => `.${name}`),
              ].join("");
              return `${identity}: ${(node.textContent ?? "").trim().slice(0, 80)}`;
            }),
          });
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
    Object.defineProperty(window, "__cumulativeLayoutShift", {
      get: () => cumulativeLayoutShift,
    });
    Object.defineProperty(window, "__layoutShifts", {
      get: () => layoutShifts,
    });
  });

  const expectStableLayout = async () => {
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    if (browserName !== "chromium") return;
    const cumulativeLayoutShift = await page.evaluate(
      () =>
        (window as typeof window & { __cumulativeLayoutShift?: number })
          .__cumulativeLayoutShift,
    );
    const layoutShifts = await page.evaluate(
      () =>
        (
          window as typeof window & {
            __layoutShifts?: Array<{ sources: string[]; value: number }>;
          }
        ).__layoutShifts,
    );
    expect(cumulativeLayoutShift).toBeDefined();
    expect(
      cumulativeLayoutShift ?? Number.POSITIVE_INFINITY,
      `${page.url()} layout shifts: ${JSON.stringify(layoutShifts)}`,
    ).toBeLessThanOrEqual(0.1);
  };

  let releaseImages = () => undefined;
  const imageGate = new Promise<void>((resolve) => {
    releaseImages = resolve;
  });
  await page.route("https://i.ytimg.com/**", async (route) => {
    await imageGate;
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  });

  await page.goto("/episodes", { waitUntil: "domcontentloaded" });
  const thumbnail = page.locator('img[src*="i.ytimg.com"]').first();
  await expect(thumbnail).toBeAttached();
  const card = thumbnail.locator("xpath=ancestor::a[1]");
  const before = await card.boundingBox();
  expect(before).not.toBeNull();

  releaseImages();
  await page.waitForLoadState("load");
  await expect(thumbnail).toHaveJSProperty("complete", true);
  await expectStableLayout();
  const after = await card.boundingBox();
  expect(after).not.toBeNull();
  expect(
    Math.abs((after?.height ?? 0) - (before?.height ?? 0)),
  ).toBeLessThanOrEqual(1);
  expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThanOrEqual(1);

  for (const route of ["/", "/search?q=labor", "/explore", "/episodes"]) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    await expectStableLayout();
    expect(
      await page.locator("img:not([width]), img:not([height])").count(),
    ).toBe(0);
  }
});

test("400-percent reflow keeps primary touch targets operable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/explore");
  await minimumTargetSize(page, "Latest");
  await minimumTargetSize(page, "Dates");

  await page.goto("/search?q=labor");
  await minimumTargetSize(page, "Copy link");
  await minimumTargetSize(page, "Copy quote");
  await minimumTargetSize(page, "Save moment");

  await page.goto(`/v/${seededVideo.id}`);
  await minimumTargetSize(page, "Find");
  const sentence = page.getByRole("button", {
    name: "Open passage at 00:00:12",
  });
  await sentence.press("Enter");
  await minimumTargetSize(page, "Save moment");
  await minimumTargetSize(page, "Copy quote");

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(
    dimensions.clientWidth + 1,
  );
});

test("public route matrix has no serious accessibility or runtime errors", async ({
  page,
}) => {
  test.setTimeout(240_000);
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

test("client profiles apply identity, assets and both themes across responsive pages", async ({
  page,
}) => {
  const profile = JSON.parse(
    fs.readFileSync(
      path.resolve("../core/config/branding/northstar.json"),
      "utf8",
    ),
  );
  await page.route("**/api/support", (route) =>
    route.fulfill({
      json: {
        donations_enabled: true,
        payment_url: "https://payments.example.org/northstar",
      },
    }),
  );
  await page.route("**/api/site", (route) =>
    route.fulfill({
      json: {
        ...profile,
        public_passages_enabled: true,
        community_enabled: false,
      },
    }),
  );
  await page.route("**/branding/*", (route) =>
    route.fulfill({
      path: path.resolve(
        "../core/config/branding/northstar-assets",
        new URL(route.request().url()).pathname.split("/").pop()!,
      ),
      contentType: "image/svg+xml",
    }),
  );
  await page.addInitScript(() =>
    localStorage.setItem("themePreference", "dark"),
  );
  // Start wide so the desktop theme toggle exists in mobile projects too; the
  // narrow half of this test resizes to 390px below.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/about");
  await expect(page.getByText("About Northstar Archive")).toBeVisible();
  await expect(page).toHaveTitle("About the archive — Northstar Archive");
  await expect(
    page.getByRole("link", { name: "Home - Northstar Archive" }).locator("img"),
  ).toHaveAttribute("src", "/branding/logo.svg");
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    "href",
    "/branding/logo.svg",
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--color-accent")
          .trim(),
      ),
    )
    .toBe("#fbbf24");
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--color-accent")
          .trim(),
      ),
    )
    .toBe("#92400e");
  await expect(page.locator("#root > div")).toHaveCSS(
    "background-color",
    "rgb(255, 253, 245)",
  );
  await page.screenshot({
    path: "../output/playwright/northstar-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("contentinfo")
    .getByRole("link", { name: "Support", exact: true })
    .click();
  await expect(page.getByText("Support Northstar Archive")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBe(390);
  await expect(page.getByText(/HasanAra|HasanAbi|Subcult/i)).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /Donate securely with Stripe/ }),
  ).toHaveAttribute("href", "https://payments.example.org/northstar");
  await page.screenshot({
    path: "../output/playwright/northstar-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});

test("passage ranges retain context, validate edits and produce public sharing links", async ({
  page,
}) => {
  await page.goto(`/v/${seededVideo.id}?t=1&t_ms=1000&end_ms=5000`);
  await expect(
    page.getByRole("heading", { name: "Share a passage" }),
  ).toBeVisible();
  await page.getByLabel("Start time", { exact: true }).fill("2");
  await page.getByLabel("End time", { exact: true }).fill("1");
  await expect(
    page.getByRole("button", { name: "Copy passage link" }),
  ).toBeDisabled();
  await page.getByLabel("End time", { exact: true }).fill("5");
  await expect(
    page.getByRole("button", { name: "Copy passage link" }),
  ).toBeEnabled();
  await expect(page.getByLabel("Passage link", { exact: true })).toHaveValue(
    new RegExp(
      `/api/share/videos/${seededVideo.id}\\?start_ms=2000&end_ms=5000$`,
    ),
  );
});

test("changing sort reruns the submitted search and restores it through history", async ({
  page,
}) => {
  const requests: URLSearchParams[] = [];
  await page.route("**/api/search/grouped?**", async (route) => {
    const params = new URL(route.request().url()).searchParams;
    requests.push(params);
    const groups = ["Older episode", "Newer episode"].map((title, index) => ({
      video: { ...seededVideo, id: `video-${index}`, title },
      moments: [
        {
          id: index + 1,
          video_id: `video-${index}`,
          start_ms: 12000,
          end_ms: 18000,
          snippet: "labor rights",
          source: "whisper",
        },
      ],
    }));
    if (params.get("sort_by") !== "date_asc") groups.reverse();
    await route.fulfill({
      json: { total_moments: 2, total_videos: 2, groups },
    });
  });
  await page.goto(
    "/search?q=labor&match_mode=exact_phrase&date_from=2026-01-01&video_id=selected&sort_by=date_desc&offset=20",
  );
  const titles = page.locator(
    ".search-result-card .search-result-head a.block",
  );
  await expect(titles).toHaveText(["Newer episode", "Older episode"]);
  const query = page.getByRole("searchbox", { name: "Search query" });
  await query.fill("unsubmitted query");
  await page.locator('input[name="date_from"]').fill("2026-02-01");
  const sort = page.getByRole("combobox", { name: "Sort" });
  await sort.selectOption("date_asc");

  await expect(titles).toHaveText(["Older episode", "Newer episode"]);
  expect(requests.at(-1)?.get("q")).toBe("labor");
  expect(requests.at(-1)?.get("match_mode")).toBe("exact_phrase");
  expect(requests.at(-1)?.get("date_from")).toBe("2026-01-01");
  expect(requests.at(-1)?.get("video_id")).toBe("selected");
  expect(requests.at(-1)?.get("offset")).toBe("0");
  await expect(query).toHaveValue("unsubmitted query");
  await expect(page.locator('input[name="date_from"]')).toHaveValue(
    "2026-02-01",
  );
  expect(new URL(page.url()).searchParams.has("offset")).toBe(false);

  for (const value of ["duration_asc", "duration_desc", "relevance"]) {
    await sort.selectOption(value);
    await expect(page).toHaveURL(new RegExp(`sort_by=${value}`));
    await expect.poll(() => requests.at(-1)?.get("sort_by")).toBe(value);
  }
  // Returning to a recent order may reuse React Query's cached results.
  await sort.selectOption("date_desc");
  await expect(page).toHaveURL(/sort_by=date_desc/);
  await expect(titles).toHaveText(["Newer episode", "Older episode"]);
  await page.goBack();
  await expect(sort).toHaveValue("relevance");
  await page.goForward();
  await expect(sort).toHaveValue("date_desc");
  await page.reload();
  await expect(sort).toHaveValue("date_desc");
  await expect(query).toHaveValue("labor");
  await expect(titles).toHaveText(["Newer episode", "Older episode"]);
});

test("plain transcript sentences wrap inline and remain keyboard operable", async ({
  page,
}) => {
  await page.route(`**/api/videos/${seededVideo.id}/transcript?**`, (route) =>
    route.fulfill({
      json: {
        video_id: seededVideo.id,
        source: "whisper",
        source_label: "Native transcript",
        segments: [
          {
            start_ms: 12000,
            end_ms: 18000,
            text: "Labor rights are worth protecting and this long passage continues across several lines in the transcript.",
          },
        ],
        blocks: [],
      },
    }),
  );
  await page.goto(`/v/${seededVideo.id}?t=12`);
  const sentence = page.locator('[data-transcript-sentence="true"]').first();
  await expect(sentence).toBeVisible();
  await sentence.evaluate((element) => {
    const paragraph = element.closest("p")!;
    paragraph.style.width = "240px";
  });
  expect(
    await sentence.evaluate((element) => element.getClientRects().length),
  ).toBeGreaterThan(1);
  await sentence.focus();
  await page.keyboard.press("Enter");
  await expect(sentence).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: "Close passage actions" }).click();
  await expect(sentence).toHaveAttribute("aria-expanded", "false");
  await sentence.focus();
  await page.keyboard.press("Space");
  await expect(sentence).toHaveAttribute("aria-expanded", "true");
});

test("completed passage exports offer an intact handoff and discard it when the range changes", async ({
  page,
}) => {
  const fixture = JSON.parse(
    fs.readFileSync(
      path.resolve("../core/docs/api/examples/clip-handoff.v1.json"),
      "utf8",
    ),
  );
  // The image copies only frontend/. Keep its local test fixture tied to core.
  expect(
    JSON.parse(
      fs.readFileSync(
        path.resolve("../frontend/src/tests/fixtures/clip-handoff.v1.json"),
        "utf8",
      ),
    ),
  ).toEqual(fixture);
  // Optional generated-fixture qualification uses the actual pinned producer API.
  const producer = process.env.CLIP_FIXTURE_API;
  const handoff = producer
    ? await (await page.request.get(`${producer}/fixture`)).json()
    : {
        ...fixture,
        recording: { ...fixture.recording, video_id: seededVideo.id },
      };
  const videoId = handoff.recording.video_id;
  const range = handoff.passage;
  const exportId = handoff.export_id;
  let requested: unknown;
  await page.route("**/api/site", (route) =>
    route.fulfill({
      json: {
        name: "HasanAra",
        creator_name: "HasanAbi",
        description: "Seeded archive",
        public_passages_enabled: true,
        community_enabled: false,
        clip_exports_enabled: true,
      },
    }),
  );
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { user: { id: "fixture-owner" } } }),
  );
  await page.route("**/api/auth/csrf", (route) =>
    route.fulfill({ json: { csrf_token: "fixture-csrf" } }),
  );
  if (producer) {
    await page.route("**/api/clips**", async (route) => {
      const url = new URL(route.request().url());
      if (route.request().method() === "POST")
        requested = route.request().postDataJSON();
      const response = await route.fetch({
        url: `${producer}${url.pathname.replace("/api", "")}`,
        maxRetries: 0,
      });
      return route.fulfill({ response });
    });
  } else {
    await page.route("**/api/clips", (route) => {
      requested = route.request().postDataJSON();
      return route.fulfill({
        status: 202,
        json: {
          id: exportId,
          status: "completed",
          expires_at: Date.now() / 1000 + 3600,
        },
      });
    });
    await page.route(`**/api/clips/${exportId}/handoff`, (route) =>
      route.fulfill({ json: handoff }),
    );
    await page.route(`**/api/clips/${exportId}/download`, (route) =>
      route.fulfill({
        contentType: "video/mp4",
        headers: {
          "Content-Disposition": 'attachment; filename="fixture.mp4"',
        },
        body: Buffer.from("mocked export bytes"),
      }),
    );
  }
  await page.goto(
    `/v/${videoId}?t_ms=${range.start_ms}&end_ms=${range.end_ms}`,
  );
  const mp4Event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export and download" }).click();
  const mp4 = await mp4Event;
  expect(requested).toEqual({
    video_id: videoId,
    start_ms: range.start_ms,
    end_ms: range.end_ms,
  });
  const jsonEvent = page.waitForEvent("download");
  // Exercise the action with the keyboard as well as the pointer.
  await page
    .getByRole("button", { name: "Download handoff JSON (v1)" })
    .focus();
  await page.keyboard.press("Enter");
  const json = await jsonEvent;
  const jsonFile = (await json.path())!;
  const received = JSON.parse(fs.readFileSync(jsonFile, "utf8"));
  expect(received).toMatchObject({
    schema: handoff.schema,
    schema_version: 1,
    passage: range,
    transcript: handoff.transcript,
    captions: handoff.captions,
    media: handoff.media,
  });
  expect(JSON.stringify(received)).not.toMatch(
    /owner_id|account_id|\/download|cookie|relative_path/,
  );
  await expect(
    page.getByRole("link", { name: "Open clpr draft importer" }),
  ).toHaveAttribute("href", "https://clpr.tv/submit");
  await expect(
    page.getByRole("textbox", { name: "Handoff JSON", exact: true }),
  ).toHaveValue(fs.readFileSync(jsonFile, "utf8"));
  await page.setViewportSize({ width: 320, height: 740 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(321);
  await page.addScriptTag({
    path: path.resolve("../frontend/node_modules/axe-core/axe.min.js"),
  });
  const handoffViolations = await page.evaluate(async () => {
    const axe = (
      window as typeof window & {
        axe: {
          run: (context: string) => Promise<{
            violations: Array<{ id: string; impact: string | null }>;
          }>;
        };
      }
    ).axe;
    return (await axe.run('[aria-label="clpr handoff"]')).violations.filter(
      (item) => item.impact === "serious" || item.impact === "critical",
    );
  });
  expect(handoffViolations).toEqual([]);
  if (process.env.CLIP_FIXTURE_OUTPUT) {
    fs.mkdirSync(process.env.CLIP_FIXTURE_OUTPUT, { recursive: true });
    await page.getByRole("region", { name: "clpr handoff" }).screenshot({
      path: path.join(
        process.env.CLIP_FIXTURE_OUTPUT,
        "hasanara-handoff-mobile.png",
      ),
    });
    await mp4.saveAs(path.join(process.env.CLIP_FIXTURE_OUTPUT, "passage.mp4"));
    await json.saveAs(
      path.join(process.env.CLIP_FIXTURE_OUTPUT, "passage.handoff.json"),
    );
  }
  if (producer) {
    const bytes = fs.readFileSync((await mp4.path())!);
    expect(bytes.length).toBe(received.media.bytes);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      received.media.sha256,
    );
  }
  if (process.env.CLPR_FIXTURE_URL) {
    if (!producer)
      throw new Error(
        "clpr qualification requires CLIP_FIXTURE_API with generated media",
      );
    const review = await page.context().newPage();
    await review.addInitScript(() =>
      localStorage.setItem("auth_session_hint", "1"),
    );
    let submissions = 0;
    await review.route("**/api/**", (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (
        route.request().method() === "POST" &&
        pathname.includes("/submissions")
      )
        submissions++;
      if (pathname.endsWith("/auth/me"))
        return route.fulfill({
          json: {
            id: "fixture-clpr-user",
            username: "fixture",
            display_name: "Generated fixture reviewer",
            role: "user",
            is_banned: false,
            karma_points: 0,
            created_at: "2026-11-09T00:00:00Z",
          },
        });
      return route.fulfill({
        json: {
          success: true,
          data: [],
          tags: [],
          notifications: [],
          unread_count: 0,
          meta: { page: 1, limit: 5, total: 0, total_pages: 0 },
        },
      });
    });
    await review.goto(`${process.env.CLPR_FIXTURE_URL}/submit`);
    const rejectCookies = review.getByRole("button", {
      name: "Reject all",
      exact: true,
    });
    if (await rejectCookies.isVisible()) await rejectCookies.click();
    await review.getByRole("radio", { name: /Upload video/i }).click();
    await review
      .getByLabel("Archive handoff (optional)")
      .setInputFiles(jsonFile);
    const panel = review.getByTestId("archive-handoff-review");
    await expect(panel).toContainText(received.archive.name);
    await panel.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(review.getByTestId("archive-handoff-current")).toHaveCount(0);
    await review
      .getByLabel("Archive handoff (optional)")
      .setInputFiles(jsonFile);
    await review
      .getByRole("button", { name: "Use in draft", exact: true })
      .click();
    await expect(review.getByLabel("Caption 1 text")).toHaveValue(
      "Generated fixture caption.",
    );
    await review.getByLabel("Video File").setInputFiles((await mp4.path())!);
    await expect(
      review.getByText("Matches the archive handoff", { exact: true }),
    ).toBeVisible();
    await expect(
      review.getByRole("link", { name: "Open the source passage" }),
    ).toHaveAttribute("href", received.passage.url);
    expect(submissions).toBe(0);
    if (process.env.CLIP_FIXTURE_OUTPUT)
      await review.screenshot({
        path: path.join(
          process.env.CLIP_FIXTURE_OUTPUT,
          "clpr-draft-review.png",
        ),
        fullPage: true,
      });
    await review.close();
  }
  await page
    .getByLabel("End time", { exact: true })
    .fill(String((range.end_ms + 1000) / 1000));
  await expect(page.getByRole("region", { name: "clpr handoff" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Download MP4 again" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Copy passage link" }),
  ).toBeEnabled();
});

test("an unavailable handoff clears the completed export while passage links still work", async ({
  page,
}) => {
  await page.route("**/api/site", (route) =>
    route.fulfill({
      json: {
        name: "HasanAra",
        creator_name: "HasanAbi",
        description: "Seeded archive",
        public_passages_enabled: true,
        community_enabled: false,
        clip_exports_enabled: true,
      },
    }),
  );
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { user: { id: "fixture-owner" } } }),
  );
  await page.route("**/api/auth/csrf", (route) =>
    route.fulfill({ json: { csrf_token: "fixture-csrf" } }),
  );
  await page.route("**/api/clips", (route) =>
    route.fulfill({
      status: 202,
      json: {
        id: "expired",
        status: "completed",
        expires_at: Date.now() / 1000 + 3600,
      },
    }),
  );
  await page.route("**/api/clips/expired/download", (route) => route.abort());
  await page.route("**/api/clips/expired/handoff", (route) =>
    route.fulfill({ status: 404, json: { detail: "Unavailable" } }),
  );
  await page.goto(`/v/${seededVideo.id}?t_ms=1000&end_ms=5000`);
  await page.getByRole("button", { name: "Export and download" }).click();
  await page.getByRole("button", { name: "Copy handoff JSON" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "This export is no longer available",
  );
  await expect(page.getByRole("region", { name: "clpr handoff" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Export and download" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Copy passage link" }),
  ).toBeEnabled();
});

test("Explore quote lands in the readable viewport and Watch pins the player between search and transcript", async ({
  page,
}) => {
  const targetMs = 5250000;
  const segments = Array.from({ length: 400 }, (_, index) => ({
    start_ms: index * 15000,
    end_ms: (index + 1) * 15000,
    text: `Archive passage ${index}. Labor rights and housing are worth discussing in detail. `.repeat(
      4,
    ),
  }));
  await page.route("**/api/archive/intelligence*", (route) =>
    route.fulfill({
      json: {
        summary: { recent_videos: [], popular_searches: [], video_count: 1 },
        topic_cards: [],
        trending_searches: [],
        suggested_searches: [],
        period_options: [],
        selected_period: {
          slug: "2026-06",
          label: "June 2026",
          kind: "month",
          date_from: "2026-06-01",
          date_to: "2026-06-30",
          video_count: 1,
        },
        periods: [
          {
            period: "2026-06",
            label: "June 2026",
            top_topics: [],
            videos: [seededVideo],
            evidence: [
              {
                video: seededVideo,
                start_ms: targetMs,
                end_ms: targetMs + 15000,
                snippet: "Archive passage 350.",
              },
            ],
          },
        ],
      },
    }),
  );
  await page.route(`**/api/videos/${seededVideo.id}/transcript*`, (route) =>
    route.fulfill({
      json: {
        video_id: seededVideo.id,
        source: "whisper",
        segments,
        blocks: [],
      },
    }),
  );
  await page.goto("/explore");
  await page.getByRole("link", { name: /Open cited moment/ }).click();
  const target = page.locator(`#moment-${targetMs}`);
  await expect(target).toBeAttached();
  await expect
    .poll(() =>
      target.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        const dock = document
          .querySelector(".reader-dock")!
          .getBoundingClientRect();
        return rect.top >= dock.bottom && rect.top < window.innerHeight - 40;
      }),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Watch", exact: true }).click();
  await page.evaluate(() => window.scrollBy(0, 600));
  await expect(page.locator(".site-header")).toHaveAttribute(
    "data-compact",
    "true",
  );
  const dock = page.locator(".reader-dock");
  await expect
    .poll(() =>
      dock.evaluate((el) =>
        Math.abs(
          el.getBoundingClientRect().top -
            document.querySelector(".site-header")!.getBoundingClientRect()
              .bottom,
        ),
      ),
    )
    .toBeLessThan(2);
  await page.screenshot({ path: "test-results/watch-layout.png" });
  const searchBottom = await page
    .locator(".transcript-toolbar")
    .evaluate((el) => el.getBoundingClientRect().bottom);
  const player = await page.locator(".watch-player").boundingBox();
  expect(player!.y).toBeGreaterThanOrEqual(searchBottom);
  expect(player!.height).toBeLessThan(350);
  await page.locator(".reader-search-controls summary").click();
  await expect(
    page.getByRole("searchbox", { name: /Search inside this VOD/ }),
  ).toBeHidden();
  await page.locator(".episode-topics summary").click();
  await expect(page.locator(".episode-topics .navigator")).toBeHidden();
});

test("the compact navigation follows scrolling and Wire visibility persists", async ({
  page,
}) => {
  await page.goto("/explore");
  await page
    .getByRole("heading", { name: "Explore the recording archive" })
    .waitFor();
  await expect(page.locator(".wire-label")).toHaveText("The Wire");
  await page.getByRole("button", { name: "Hide The Wire" }).click();
  await expect(page.locator("#wire-content")).toBeHidden();
  await expect
    .poll(() =>
      page
        .locator(".wire")
        .evaluate((el) => el.getBoundingClientRect().height),
    )
    .toBe(0);
  await expect(
    page.getByRole("button", { name: "Show The Wire" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Show The Wire" }),
  ).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.getByRole("heading", { name: "June 2026", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".period-vod")).toHaveCount(1);
  await page.evaluate(() => window.scrollTo(0, 500));
  await expect(page.locator(".site-header")).toHaveAttribute(
    "data-compact",
    "true",
  );
  expect(
    await page
      .locator(".site-header-row")
      .evaluate((el) => el.getBoundingClientRect().height),
  ).toBe(48);
  await page.getByRole("button", { name: "Show The Wire" }).click();
  await expect(page.locator("#wire-content")).toBeVisible();
  await page.getByRole("button", { name: "Pause ticker" }).click();
  await expect(page.locator(".wire")).toHaveAttribute("data-paused", "true");
});

test("period VODs paginate the whole date range without stretching to the evidence column", async ({
  page,
}) => {
  const queries: URLSearchParams[] = [];
  await page.route("**/api/videos?*", async (route) => {
    const params = new URL(route.request().url()).searchParams;
    queries.push(params);
    const second = params.has("cursor");
    await route.fulfill({
      json: {
        items: Array.from({ length: second ? 1 : 12 }, (_, index) => ({
          ...seededVideo,
          id: `period-${second ? 12 : index}`,
          title: `Period broadcast ${second ? 12 : index}`,
        })),
        page_info: {
          has_next_page: !second,
          next_cursor: second ? null : "next-page",
          total_count: 13,
        },
      },
    });
  });
  await page.goto("/explore");
  await expect(page.locator(".period-vod")).toHaveCount(12);
  await page.getByRole("button", { name: "Load more VODs" }).click();
  await expect(page.locator(".period-vod")).toHaveCount(13);
  expect(
    queries.every(
      (params) =>
        params.get("date_from") === "2026-06-01" &&
        params.get("date_to") === "2026-06-30" &&
        params.get("date_field") === "broadcast_date",
    ),
  ).toBe(true);
  expect(queries.at(-1)!.get("cursor")).toBe("next-page");
  const card = await page.locator(".period-vod").first().boundingBox();
  expect(card!.height).toBeLessThan(300);
  await page.screenshot({ path: "test-results/explore-period.png" });
});

test("account profile and sign-in panels have equal desktop dimensions and reflow on a phone", async ({
  page,
}) => {
  const user = {
    id: "fixture-user",
    name: "Archive viewer",
    email: "fixture@example.test",
    role: "user",
  };
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { user } }),
  );
  await page.route("**/api/auth/csrf", (route) =>
    route.fulfill({ json: { csrf_token: "fixture-csrf" } }),
  );
  await page.route("**/api/account", (route) =>
    route.fulfill({
      json: {
        user,
        sessions: [],
        identities: [
          {
            id: "google",
            provider: "google",
            name: "Archive viewer",
            email: "fixture@example.test",
          },
        ],
      },
    }),
  );
  await page.goto("/account");
  const profile = page.getByRole("region", { name: "Profile", exact: true });
  const identities = page.getByRole("region", {
    name: "Linked sign-ins",
    exact: true,
  });
  await expect(profile).toBeVisible();
  const a = await profile.boundingBox();
  const b = await identities.boundingBox();
  expect(Math.abs(a!.height - b!.height)).toBeLessThan(1);
  expect(Math.abs(a!.width - b!.width)).toBeLessThan(1);
  await page.setViewportSize({ width: 390, height: 844 });
  expect((await identities.boundingBox())!.y).toBeGreaterThan(
    (await profile.boundingBox())!.y + (await profile.boundingBox())!.height,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
