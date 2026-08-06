# Release defect preflight — 2026-08-06

- Query time: 2026-08-06T07:43:54Z
- Candidate commit: `3898fb45d59b35f45cb344c9ef9ab8cd6fecae35`
- Tracker: `https://git.subcult.tv`

## Result

- `subculture-collective/hasanara`: 0 open issues.
- Legacy `subculture-collective/transcript-create`: 1 open issue, `#1 [ROADMAP] Repository maintenance plan`, labeled `area:docs`, `status:ready`, and `type:maintenance`. It is not classified as an S0–S2 release defect.
- No open S0, S1, or S2 defect was returned by either repository query.

This is preflight evidence only. NX-025 remains open because the query must be repeated immediately before promotion against the deployed commit and approved by the release owner.

## Reproduction

```sh
tea issues ls --repo subculture-collective/hasanara --state open \
  --fields index,title,state,labels,assignees,updated --output json
tea issues ls --repo subculture-collective/transcript-create --state open \
  --fields index,title,state,labels,assignees,updated --output json
```
