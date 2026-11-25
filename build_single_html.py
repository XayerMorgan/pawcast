#!/usr/bin/env python3
"""
Optimizes PawCast image assets (WebP hero backdrops, PWA icons, favicon)
and builds a singular, self-contained HTML file (`pawcast.html`) with
CSS, JS, and optimized base64 image data URIs inlined.

Usage:
    python build_single_html.py
"""
import base64
import io
import re
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent


def optimize_assets() -> dict[str, bytes]:
    """Generate optimized WebP/JPEG hero images and PWA PNG icons."""
    generated: dict[str, bytes] = {}

    # 1. Hero day/night images -> 960px wide WebP + optimized JPEG fallback
    for stem in ("field_station_day", "field_station_night"):
        src = ROOT / f"{stem}.jpg"
        with Image.open(src) as img:
            rgb = img.convert("RGB")
            if rgb.width > 960:
                ratio = 960.0 / rgb.width
                rgb = rgb.resize((960, max(1, int(rgb.height * ratio))), Image.Resampling.LANCZOS)

            webp_buf = io.BytesIO()
            rgb.save(webp_buf, format="WEBP", quality=78, method=6)
            webp_bytes = webp_buf.getvalue()
            (ROOT / f"{stem}.webp").write_bytes(webp_bytes)
            generated[f"{stem}.webp"] = webp_bytes

            # Overwrite oversized 1MB+ JPEG with display-sized optimized JPEG (~90-120 KB)
            jpg_buf = io.BytesIO()
            rgb.save(jpg_buf, format="JPEG", quality=80, optimize=True, progressive=True)
            jpg_bytes = jpg_buf.getvalue()
            src.write_bytes(jpg_bytes)
            generated[f"{stem}.jpg"] = jpg_bytes

    # 2. Favicon & PWA icons from pawcast_logo.png
    logo_src = ROOT / "pawcast_logo.png"
    with Image.open(logo_src) as logo:
        rgba = logo.convert("RGBA")
        icon_specs = [
            ("favicon-32.png", 32, False),
            ("icon-180.png", 180, False),
            ("icon-192.png", 192, False),
            ("icon-512.png", 512, False),
            ("icon-maskable-512.png", 512, True),
        ]
        for fname, size, maskable in icon_specs:
            if maskable:
                canvas = Image.new("RGBA", (size, size), (17, 19, 21, 255))
                inner = int(size * 0.78)
                resized = rgba.resize((inner, inner), Image.Resampling.LANCZOS)
                offset = (size - inner) // 2
                canvas.paste(resized, (offset, offset), resized)
                out_img = canvas
            else:
                out_img = rgba.resize((size, size), Image.Resampling.LANCZOS)

            buf = io.BytesIO()
            out_img.save(buf, format="PNG", optimize=True)
            data = buf.getvalue()
            (ROOT / fname).write_bytes(data)
            generated[fname] = data

        # Compact 128px logo data URI for inline header emblem
        logo128 = rgba.resize((128, 128), Image.Resampling.LANCZOS)
        lbuf = io.BytesIO()
        logo128.save(lbuf, format="PNG", optimize=True)
        generated["logo_inline.png"] = lbuf.getvalue()

    return generated


def to_data_uri(data: bytes, mime: str) -> str:
    return f"data:{mime};base64,{base64.b64encode(data).decode('ascii')}"


def build() -> Path:
    assets = optimize_assets()

    html = (ROOT / "weather.html").read_text(encoding="utf-8")
    css = (ROOT / "styles.css").read_text(encoding="utf-8")
    js = (ROOT / "app.js").read_text(encoding="utf-8")

    favicon_uri = to_data_uri(assets["favicon-32.png"], "image/png")
    logo_uri = to_data_uri(assets["logo_inline.png"], "image/png")
    day_webp_uri = to_data_uri(assets["field_station_day.webp"], "image/webp")
    night_webp_uri = to_data_uri(assets["field_station_night.webp"], "image/webp")

    # Inline hero images in CSS (single compact WebP data URI for standalone HTML)
    css = re.sub(
        r"background-image:\s*url\(['\"]field_station_day\.jpg['\"]\);\s*background-image:\s*image-set\([^\n]+;",
        f"background-image: url('{day_webp_uri}');",
        css,
    )
    css = re.sub(
        r"background-image:\s*url\(['\"]field_station_night\.jpg['\"]\);\s*background-image:\s*image-set\([^\n]+;",
        f"background-image: url('{night_webp_uri}');",
        css,
    )
    css = css.replace("url('field_station_day.jpg')", f"url('{day_webp_uri}')")
    css = css.replace("url('field_station_night.jpg')", f"url('{night_webp_uri}')")

    # Inline local icon/logo refs in HTML and strip multi-file manifest/preload links for singular file
    html = html.replace('href="favicon-32.png"', f'href="{favicon_uri}"')
    html = html.replace('href="icon-180.png"', f'href="{logo_uri}"')
    html = html.replace('src="pawcast_logo.png"', f'src="{logo_uri}"')
    html = re.sub(r'\s*<link\s+rel="manifest"[^>]+>', '', html)
    html = re.sub(r'\s*<link\s+rel="preload"\s+as="image"[^>]+>', '', html)

    # Inline CSS
    css_link_pattern = r'<link\s+rel=["\']stylesheet["\']\s+href=["\']styles\.css["\']\s*/?>'
    if not re.search(css_link_pattern, html):
        raise RuntimeError("Could not locate styles.css link in weather.html")
    html = re.sub(css_link_pattern, lambda _: f"<style>\n{css}\n  </style>", html, count=1)

    # Inline JS (safely escaping </script> inside JS string literals)
    safe_js = js.replace("</script>", "<\\/script>")
    js_tag_pattern = r'<script\s+src=["\']app\.js["\'](?:\s+defer)?\s*></script>'
    if not re.search(js_tag_pattern, html):
        raise RuntimeError("Could not locate app.js script tag in weather.html")
    html = re.sub(js_tag_pattern, lambda _: f"<script>\n{safe_js}\n  </script>", html, count=1)

    out_path = ROOT / "pawcast.html"
    out_path.write_text(html, encoding="utf-8")

    print("Optimized assets:")
    for k in ("field_station_day.webp", "field_station_day.jpg", "field_station_night.webp", "field_station_night.jpg", "favicon-32.png", "icon-192.png", "icon-512.png"):
        print(f"  {k}: {len(assets[k]) / 1024.0:.1f} KB")
    print(f"Built {out_path.name} ({out_path.stat().st_size / 1024.0:.1f} KB)")
    return out_path


if __name__ == "__main__":
    build()
