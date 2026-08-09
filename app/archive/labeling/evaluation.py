from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

from sqlalchemy import text

SUPPRESSED_LABEL_STATUSES = {"hidden", "rejected", "merged"}


@dataclass(frozen=True)
class LabelQualityMetrics:
    labels_total: int = 0
    auto_published: int = 0
    review_candidates: int = 0
    shadow: int = 0
    assignments_total: int = 0
    assignments_without_evidence: int = 0
    admin_approval_rate: float = 0.0
    rejected_rate: float = 0.0
    labels_without_evidence: int = 0
    duplicate_collision_candidates: int = 0
    assignment_vods: int = 0
    window_assignments: int = 0
    chapter_assignments: int = 0

    def as_dict(self) -> dict[str, int | float]:
        return asdict(self)


@dataclass(frozen=True)
class EnrichmentBenchmarkMetrics:
    tag_precision_at_5: float = 0.0
    tag_recall_at_10: float = 0.0
    junk_tag_rate: float = 0.0
    chapter_boundary_f1: float = 0.0
    chapter_coverage: float = 0.0
    fragment_title_rate: float = 0.0

    def as_dict(self) -> dict[str, float]:
        return asdict(self)


def _normalized(value: str) -> str:
    return " ".join(value.strip().casefold().split())


def _ratio(numerator: int | float, denominator: int | float) -> float:
    return round(numerator / denominator, 4) if denominator else 0.0


def _boundary_f1(predicted: list[int], expected: list[int], tolerance_ms: int) -> float:
    unmatched = set(range(len(expected)))
    matches = 0
    for boundary in predicted:
        candidates = [index for index in unmatched if abs(expected[index] - boundary) <= tolerance_ms]
        if not candidates:
            continue
        closest = min(candidates, key=lambda index: abs(expected[index] - boundary))
        unmatched.remove(closest)
        matches += 1
    if not predicted or not expected:
        return 0.0
    precision = matches / len(predicted)
    recall = matches / len(expected)
    return round(2 * precision * recall / (precision + recall), 4) if precision + recall else 0.0


def _chapter_coverage(chapters: list[dict[str, Any]], duration_ms: int) -> float:
    if duration_ms <= 0:
        return 0.0
    intervals = sorted(
        (max(0, int(item.get("start_ms") or 0)), min(duration_ms, int(item.get("end_ms") or 0)))
        for item in chapters
        if int(item.get("end_ms") or 0) > int(item.get("start_ms") or 0)
    )
    covered = 0
    cursor_start: int | None = None
    cursor_end = 0
    for start, end in intervals:
        if end <= start:
            continue
        if cursor_start is None:
            cursor_start, cursor_end = start, end
        elif start > cursor_end:
            covered += cursor_end - cursor_start
            cursor_start, cursor_end = start, end
        else:
            cursor_end = max(cursor_end, end)
    if cursor_start is not None:
        covered += cursor_end - cursor_start
    return _ratio(covered, duration_ms)


def _is_fragment_title(title: str) -> bool:
    normalized = _normalized(title).strip(".!?…")
    words = normalized.split()
    fillers = {"again", "okay", "ok", "wow", "yeah", "right", "anyway", "so"}
    return len(words) < 3 or normalized in fillers


def evaluate_enrichment_predictions(
    *,
    predicted_tags: list[str],
    expected_tags: list[str],
    predicted_chapters: list[dict[str, Any]],
    expected_chapter_starts_ms: list[int],
    duration_ms: int,
    junk_tags: list[str] | None = None,
    boundary_tolerance_ms: int = 90_000,
) -> EnrichmentBenchmarkMetrics:
    """Score one episode against editor-reviewed tags and chapter boundaries."""
    predicted = list(dict.fromkeys(_normalized(tag) for tag in predicted_tags if _normalized(tag)))
    expected = {_normalized(tag) for tag in expected_tags if _normalized(tag)}
    junk = {_normalized(tag) for tag in (junk_tags or []) if _normalized(tag)}
    top_five = predicted[:5]
    top_ten = predicted[:10]
    predicted_starts = [int(item.get("start_ms") or 0) for item in predicted_chapters]
    fragment_count = sum(1 for item in predicted_chapters if _is_fragment_title(str(item.get("title") or "")))
    return EnrichmentBenchmarkMetrics(
        tag_precision_at_5=_ratio(sum(tag in expected for tag in top_five), len(top_five)),
        tag_recall_at_10=_ratio(sum(tag in expected for tag in top_ten), len(expected)),
        junk_tag_rate=_ratio(sum(tag in junk for tag in predicted), len(predicted)),
        chapter_boundary_f1=_boundary_f1(predicted_starts, expected_chapter_starts_ms, boundary_tolerance_ms),
        chapter_coverage=_chapter_coverage(predicted_chapters, duration_ms),
        fragment_title_rate=_ratio(fragment_count, len(predicted_chapters)),
    )


def calculate_label_quality_metrics(
    labels: list[dict[str, Any]], assignments: list[dict[str, Any]]
) -> LabelQualityMetrics:
    assignment_by_label: dict[str, list[dict[str, Any]]] = {}
    for assignment in assignments:
        label_id = str(assignment.get("label_id") or "")
        assignment_by_label.setdefault(label_id, []).append(assignment)

    reviewed_assignments = [
        assignment for assignment in assignments if assignment.get("status") in {"admin_approved", "rejected"}
    ]
    admin_approved = sum(1 for assignment in reviewed_assignments if assignment.get("status") == "admin_approved")
    rejected = sum(1 for assignment in reviewed_assignments if assignment.get("status") == "rejected")
    reviewed_count = len(reviewed_assignments)

    collision_values: list[str] = []
    for label in labels:
        if label.get("slug"):
            collision_values.append(_normalized(str(label["slug"])))
        if label.get("label"):
            collision_values.append(_normalized(str(label["label"])))
        aliases = label.get("aliases") or []
        if isinstance(aliases, str):
            aliases = [aliases]
        collision_values.extend(_normalized(str(alias)) for alias in aliases if alias)
    duplicate_collision_candidates = len(collision_values) - len(set(collision_values))

    labels_without_evidence = 0
    for label in labels:
        if str(label.get("status") or "").lower() in SUPPRESSED_LABEL_STATUSES:
            continue
        rows = assignment_by_label.get(str(label.get("id") or ""), [])
        if not any(int(row.get("evidence_count") or 0) > 0 for row in rows):
            labels_without_evidence += 1

    return LabelQualityMetrics(
        labels_total=len(labels),
        auto_published=sum(1 for assignment in assignments if assignment.get("status") == "auto_published"),
        review_candidates=sum(1 for label in labels if label.get("status") in {"candidate", "review"}),
        shadow=sum(
            1
            for assignment in assignments
            if assignment.get("status") == "shadow" or assignment.get("publish_tier") == "shadow"
        ),
        assignments_total=len(assignments),
        assignments_without_evidence=sum(
            1 for assignment in assignments if int(assignment.get("evidence_count") or 0) <= 0
        ),
        admin_approval_rate=round(admin_approved / reviewed_count, 4) if reviewed_count else 0.0,
        rejected_rate=round(rejected / reviewed_count, 4) if reviewed_count else 0.0,
        labels_without_evidence=labels_without_evidence,
        duplicate_collision_candidates=duplicate_collision_candidates,
        assignment_vods=len(
            {str(assignment.get("video_id")) for assignment in assignments if assignment.get("video_id")}
        ),
        window_assignments=sum(1 for assignment in assignments if assignment.get("unit_type") == "window"),
        chapter_assignments=sum(1 for assignment in assignments if assignment.get("unit_type") == "chapter"),
    )


def build_label_quality_report(db) -> LabelQualityMetrics:
    labels = [dict(row) for row in db.execute(text("""
                SELECT l.id, l.slug, l.label, l.status, COALESCE(json_agg(a.alias) FILTER (WHERE a.alias IS NOT NULL), '[]') AS aliases
                FROM archive_labels l
                LEFT JOIN archive_label_aliases a ON a.label_id = l.id AND a.status = 'active'
                GROUP BY l.id, l.slug, l.label, l.status
                """)).mappings().all()]
    assignments = [dict(row) for row in db.execute(text("""
                SELECT label_id, video_id, unit_type, status, publish_tier, evidence_count
                FROM archive_label_assignments
                """)).mappings().all()]
    return calculate_label_quality_metrics(labels, assignments)


def format_label_quality_report(metrics: LabelQualityMetrics) -> str:
    values = metrics.as_dict()
    ordered_keys = [
        "labels_total",
        "auto_published",
        "review_candidates",
        "shadow",
        "assignments_total",
        "assignments_without_evidence",
        "admin_approval_rate",
        "rejected_rate",
        "labels_without_evidence",
        "duplicate_collision_candidates",
        "assignment_vods",
        "window_assignments",
        "chapter_assignments",
    ]
    lines = ["label quality report:"]
    lines.extend(f"{key}={values[key]}" for key in ordered_keys)
    return "\n".join(lines)
