"""Brief caching of public, user-independent mention-map results."""

import hashlib
import json

from app import crud
from app.cache import get_redis_client
from app.schemas import MentionMap
from app.settings import settings


def cached_mention_map(db, **params) -> MentionMap:
    # Include every filter/pagination argument and avoid storing raw search terms
    # in Redis keys or logs. User analytics/history remain outside this cache.
    digest = hashlib.sha256(json.dumps(params, sort_keys=True, default=str).encode()).hexdigest()
    key = f"mention-map:v1:{digest}"
    client = get_redis_client() if settings.ENABLE_CACHING else None
    if client is not None:
        try:
            cached = client.get(key)
            if cached is not None:
                return MentionMap.model_validate_json(cached)
        except Exception:
            pass  # Cache failures must not replace valid search results.
    result = MentionMap.model_validate(crud.get_mention_map(db, **params))
    if client is not None:
        try:
            client.setex(key, 60, result.model_dump_json())
        except Exception:
            pass
    return result
