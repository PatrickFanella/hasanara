# Settled frontend decisions

These archive-interface decisions are intentional product constraints. Do not reintroduce them as polish, advanced controls, or transcript diagnostics without a new explicit product decision.

- VOD duration is not a useful filter for this archive of long broadcasts. Do not add minimum or maximum duration controls, chips, URL state, or generated request parameters.
- The VOD feed has only inline From/To date controls. Desktop keeps them in the toolbar; mobile uses an in-flow disclosure. Do not use a filter modal or dialog.
- Users see one canonical transcript. Do not expose transcript-source names, source selectors, source-colored availability markers, source disagreements, or source badges in public, authenticated, saved, topic, or VOD views.
- Generated moment links are source neutral: `t`, optional `t_ms`, and `#moment-{start_ms}`. Legacy source-bearing and segment links remain input compatibility only and normalize after successful navigation.
- Transcript provenance and source selection remain internal API and implementation data.
