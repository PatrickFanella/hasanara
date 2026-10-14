#!/usr/bin/env python3
"""Render crawler-visible branding before Nginx starts, without an API dependency."""

import html
import json
import os
import re
import subprocess
from pathlib import Path
from urllib.parse import urljoin, urlsplit
from xml.sax.saxutils import escape as xml_escape


def render(root: Path, environ: dict) -> None:
    profile_path = environ.get("SITE_PROFILE_PATH", "")
    profile = json.loads(Path(profile_path).read_text()) if profile_path else {}
    origin = environ.get("FRONTEND_ORIGIN", "")
    if profile_path and not origin:
        raise ValueError("FRONTEND_ORIGIN is required with SITE_PROFILE_PATH")
    origin = origin or "http://localhost"
    parsed = urlsplit(origin)
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.netloc
        or parsed.username
        or parsed.password
        or parsed.path not in {"", "/"}
        or parsed.query
        or parsed.fragment
    ):
        raise ValueError("FRONTEND_ORIGIN must be an absolute HTTP(S) origin")
    origin = origin.rstrip("/") + "/"
    name = environ.get("SITE_NAME", profile.get("name", "Transcript Archive"))
    description = environ.get(
        "SITE_DESCRIPTION",
        profile.get("description", "Search the archive, share a passage, and keep its context."),
    )
    image = profile.get("social_image_url") or "/social-card.svg"
    dimensions = []
    if urlsplit(image).path.lower().endswith(".svg"):
        if not image.startswith("/") or image.startswith("//"):
            raise ValueError("SVG social images must be local; use a PNG or JPEG for remote images")
        source = (root / urlsplit(image).path.lstrip("/")).resolve()
        if not source.is_relative_to(root.resolve()) or not source.is_file():
            raise ValueError("Social image must exist inside the public directory")
        # Write outside the read-only client asset mount; never alter the original artwork.
        destination = root / "social-preview.png"
        temporary = root / "social-preview.tmp.png"
        subprocess.run(
            ["rsvg-convert", "--width", "1200", "--height", "630", "--output", str(temporary), str(source)],
            check=True,
        )
        temporary.replace(destination)
        image = "/social-preview.png"
        dimensions = [("og:image:type", "image/png"), ("og:image:width", "1200"), ("og:image:height", "630")]
    image = urljoin(origin, image)
    if urlsplit(image).scheme not in {"http", "https"}:
        raise ValueError("Social image must be an HTTP(S) URL")
    escape = html.escape
    creator = profile.get("creator_name", "")
    title = f"{name} — {creator} broadcast transcripts" if creator else name
    tags = [f"<title>{escape(title)}</title>", f'<meta name="description" content="{escape(description)}" />']
    for key, value in [
        ("og:type", "website"),
        ("og:site_name", name),
        ("og:title", name),
        ("og:description", description),
        ("og:url", origin),
        ("og:image", image),
        ("og:image:alt", name),
        *dimensions,
        ("twitter:card", "summary_large_image"),
        ("twitter:title", name),
        ("twitter:description", description),
        ("twitter:image", image),
        ("twitter:image:alt", name),
    ]:
        attribute = "name" if key.startswith("twitter:") else "property"
        tags.append(f'<meta {attribute}="{key}" content="{escape(value)}" />')
    index = root / "index.html"
    source = re.sub(r'<link rel="canonical"[^>]*>', "", index.read_text())
    source, roots = re.subn(r'<div id="root">.*?</div>', '<div id="root"></div>', source, flags=re.DOTALL)
    if roots != 1:
        raise ValueError("Expected exactly one root placeholder")
    start, end = "<!-- site-metadata:start -->", "<!-- site-metadata:end -->"
    pattern = re.escape(start) + r".*?" + re.escape(end)
    replacement = start + "\n    " + "\n    ".join(tags) + "\n    " + end
    result, count = re.subn(pattern, lambda _: replacement, source, flags=re.DOTALL)
    if count != 1:
        raise ValueError("Expected exactly one site metadata block in index.html")
    # Keep a neutral shell for deep links: their URLs must not canonicalize to home.
    (root / "app.html").write_text(result)
    (root / "private.html").write_text(result.replace("</head>", '<meta name="robots" content="noindex,nofollow" /></head>'))
    intro = (
        '<main><section class="archive-masthead"><p class="archive-eyebrow">'
        + escape(f"{creator} archive" if creator else name)
        + '</p><h1 class="archive-display">Find the moment. Read the record.</h1><p>'
        + escape(description)
        + '</p><nav aria-label="Explore the archive"><a href="/explore">Explore the archive</a> · '
        + '<a href="/episodes">Browse broadcasts</a> · <a href="/about">About the archive</a></nav>'
        + '<p>' + escape(profile.get("project_notice", "")) + '</p></section></main>'
    )
    result = result.replace('<div id="root"></div>', '<div id="root">' + intro + '</div>')
    result = result.replace("</head>", f'<link rel="canonical" href="{escape(origin)}" /></head>')
    (root / "robots.txt").write_text(
        "User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /account\nDisallow: /saved\nDisallow: /favorites\nDisallow: /at.html\n\nSitemap: " + origin + "sitemap.xml\n"
    )
    (root / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>'
        + xml_escape(origin) + '</loc></url></urlset>\n'
    )
    temporary = root / "index.html.tmp"
    temporary.write_text(result)
    temporary.replace(index)


if __name__ == "__main__":
    render(Path("/usr/share/nginx/html"), dict(os.environ))
