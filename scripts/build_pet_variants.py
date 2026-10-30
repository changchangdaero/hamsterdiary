"""Rebuild animation frames so frames that alternate share one identical body.

The source sheet draws every frame by hand, so bodies differ slightly between
frames and alternating them makes the hamster jitter. This script keeps one
body per animation and only swaps the parts that should move:

- sleep0..3: the sleep1 body, plus the detached Z glyphs of sleep1..3 (none for sleep0)
- talk:      the idle body with the open mouth from talk

It is idempotent: running it on its own output produces the same frames.
"""

from collections import deque
from pathlib import Path
import sys

from PIL import Image

# Box around the mouth (below the nose stem) in the 360x340 frame space.
MOUTH_BOX = (126, 171, 190, 206)
# Skin sampled around the mouth, used to paint over the old mouth.
SKIN_SAMPLE_BOX = (120, 165, 196, 212)


def load(directory: Path, name: str) -> Image.Image:
    return Image.open(directory / f"{name}.png").convert("RGBA")


def components(image: Image.Image) -> list[set[tuple[int, int]]]:
    """Return 8-connected opaque regions, largest (the body) first."""
    width, height = image.size
    pixels = image.load()
    seen: set[tuple[int, int]] = set()
    found: list[set[tuple[int, int]]] = []
    for y in range(height):
        for x in range(width):
            if pixels[x, y][3] == 0 or (x, y) in seen:
                continue
            region: set[tuple[int, int]] = set()
            queue = deque([(x, y)])
            seen.add((x, y))
            while queue:
                cx, cy = queue.popleft()
                region.add((cx, cy))
                for nx in range(max(0, cx - 1), min(width, cx + 2)):
                    for ny in range(max(0, cy - 1), min(height, cy + 2)):
                        if (nx, ny) not in seen and pixels[nx, ny][3] > 0:
                            seen.add((nx, ny))
                            queue.append((nx, ny))
            found.append(region)
    found.sort(key=len, reverse=True)
    return found


def body_only(image: Image.Image) -> Image.Image:
    body = components(image)[0]
    result = Image.new("RGBA", image.size, (0, 0, 0, 0))
    source, target = image.load(), result.load()
    for x, y in body:
        target[x, y] = source[x, y]
    return result


def with_glyphs(body: Image.Image, glyph_source: Image.Image) -> Image.Image:
    """Paste every detached glyph (Z letters) of glyph_source onto body."""
    result = body.copy()
    source, target = glyph_source.load(), result.load()
    for region in components(glyph_source)[1:]:
        for x, y in region:
            target[x, y] = source[x, y]
    return result


def is_mouth_pixel(pixel: tuple[int, int, int, int]) -> bool:
    """Dark line art or the reddish mouth interior, never cream skin."""
    red, green, blue, alpha = pixel
    if alpha == 0:
        return False
    darkness = (red + green + blue) / 3
    reddish = red > 150 and green < 150 and red - green > 60
    return darkness < 140 or reddish


def skin_color(image: Image.Image) -> tuple[int, int, int, int]:
    pixels = image.load()
    left, top, right, bottom = SKIN_SAMPLE_BOX
    samples = [
        pixels[x, y]
        for x in range(left, right)
        for y in range(top, bottom)
        if pixels[x, y][3] == 255
        and not is_mouth_pixel(pixels[x, y])
        and sum(pixels[x, y][:3]) / 3 > 190
    ]
    samples.sort(key=lambda pixel: sum(pixel[:3]))
    return samples[len(samples) // 2]


def is_line_art(pixel: tuple[int, int, int, int]) -> bool:
    return pixel[3] > 0 and sum(pixel[:3]) / 3 < 70


def mouth_top(image: Image.Image) -> int:
    """First row of black mouth line art; the brown nose stem sits above it."""
    pixels = image.load()
    left, top, right, bottom = MOUTH_BOX
    return min(
        y
        for x in range(left, right)
        for y in range(top, bottom)
        if is_line_art(pixels[x, y])
    )


def mouth_mask(image: Image.Image) -> set[tuple[int, int]]:
    pixels = image.load()
    left, _top, right, bottom = MOUTH_BOX
    return {
        (x, y)
        for x in range(left, right)
        for y in range(mouth_top(image), bottom)
        if is_mouth_pixel(pixels[x, y])
    }


def erase_mouth(image: Image.Image) -> Image.Image:
    """Paint the mouth and its soft anti-aliased fringe back to skin."""
    result = image.copy()
    pixels = result.load()
    skin = skin_color(image)
    mask = mouth_mask(image)
    left = min(x for x, _ in mask) - 3
    right = max(x for x, _ in mask) + 3
    top = mouth_top(image)
    bottom = max(y for _, y in mask) + 3
    for x in range(left, right + 1):
        for y in range(top, bottom + 1):
            red, green, blue, alpha = pixels[x, y]
            distance = abs(red - skin[0]) + abs(green - skin[1]) + abs(blue - skin[2])
            if alpha > 0 and distance > 24:
                pixels[x, y] = skin
    return result


def paste_mouth(
    face: Image.Image, mouth_source: Image.Image, anchor_top: int
) -> Image.Image:
    """Copy mouth_source's mouth onto face, centered on face's own mouth."""
    source_mask = mouth_mask(mouth_source)
    face_mask = mouth_mask(face)
    source_pixels = mouth_source.load()
    min_x = min(x for x, _ in source_mask)
    max_x = max(x for x, _ in source_mask)
    min_y = min(y for _, y in source_mask)
    face_center_x = (min(x for x, _ in face_mask) + max(x for x, _ in face_mask)) // 2
    offset_x = face_center_x - (min_x + max_x) // 2

    result = erase_mouth(face)
    target = result.load()
    for x, y in source_mask:
        local_y = y - min_y
        target[x + offset_x, anchor_top + local_y] = source_pixels[x, y]
    return result


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: build_pet_variants.py SOURCE_DIR OUTPUT_DIR")
    source_dir = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])
    output_dir.mkdir(parents=True, exist_ok=True)

    sleep_body = body_only(load(source_dir, "sleep1"))
    sleep_body.save(output_dir / "sleep0.png")
    for name in ("sleep1", "sleep2", "sleep3"):
        with_glyphs(sleep_body, load(source_dir, name)).save(output_dir / f"{name}.png")

    idle = load(source_dir, "idle")
    talk = load(source_dir, "talk")
    paste_mouth(idle, talk, anchor_top=mouth_top(talk)).save(
        output_dir / "talk.png"
    )


if __name__ == "__main__":
    main()
