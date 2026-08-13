from app.pagination import build_offset_page


def test_build_offset_page_uses_extra_row_to_report_next_page():
    items, page_info = build_offset_page(["a", "b", "c"], limit=2, offset=0)

    assert items == ["a", "b"]
    assert page_info.model_dump() == {
        "limit": 2,
        "offset": 0,
        "has_next_page": True,
        "has_previous_page": False,
        "next_offset": 2,
        "previous_offset": None,
    }


def test_build_offset_page_reports_final_and_previous_page():
    items, page_info = build_offset_page(["c"], limit=2, offset=2)

    assert items == ["c"]
    assert page_info.model_dump() == {
        "limit": 2,
        "offset": 2,
        "has_next_page": False,
        "has_previous_page": True,
        "next_offset": None,
        "previous_offset": 0,
    }
