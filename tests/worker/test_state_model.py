from worker.state_model import (
    DiarizationState,
    JobState,
    VideoState,
    job_state_from_video_states,
    pending_video_eligibility_sql,
)


def test_job_completes_when_all_videos_completed():
    assert job_state_from_video_states([VideoState.COMPLETED, VideoState.COMPLETED]) == JobState.COMPLETED


def test_job_fails_when_no_active_videos_and_any_failed():
    assert job_state_from_video_states([VideoState.COMPLETED, VideoState.FAILED]) == JobState.FAILED


def test_job_keeps_running_with_pending_video():
    assert job_state_from_video_states([VideoState.COMPLETED, VideoState.PENDING]) == JobState.DOWNLOADING


def test_diarization_states_include_failed_and_skipped():
    assert DiarizationState.FAILED.value == "failed"
    assert DiarizationState.SKIPPED.value == "skipped"


def test_video_state_model_includes_db_enum_states():
    assert VideoState.DIARIZING.value == "diarizing"
    assert VideoState.PERSISTING.value == "persisting"
    assert VideoState.EXPANDED.value == "expanded"


def test_pending_native_eligibility_excludes_all_canary_markers():
    assert "v.diarization_error IS NULL OR v.diarization_error NOT LIKE 'canary-%'" in pending_video_eligibility_sql()
