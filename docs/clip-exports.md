# Clip exports

Select a transcript segment and choose **Start clip here**. Select the last
segment and choose **End clip here**. The passage panel lets you preview and
adjust the range. Clips are limited to two minutes.

Sign in and choose **Export and download**. The page checks progress and starts
the MP4 download automatically when it is ready. Keep the page open until it
starts. If your browser blocks it, use **Download MP4 again**.

**Save range** stores both timestamps in your account's Saved moments. Reopen
the saved moment to regenerate the clip after its server copy expires. The range
stays saved independently of the temporary MP4. Saving a range does not download
media; exporting one does.

Rekolekt must enable `CLIP_EXPORTS_ENABLED`, set `CLIP_EXPORT_SOURCE=youtube`,
and run its clip worker with the same private spool as the API. Its default cache
lifetime is one hour after successful rendering, configurable through
`CLIP_CACHE_TTL_SECONDS`. The worker downloads the selected section with yt-dlp
and removes expired media automatically. See Rekolekt's `docs/product/youtube-clips.md`
for setup, limits and API behavior. This frontend change does not deploy or enable
the backend worker.
