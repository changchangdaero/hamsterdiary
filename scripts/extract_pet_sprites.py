"""Extract the supplied hamster sheet without resampling or redrawing pixels."""

from pathlib import Path
from shutil import copy2
from collections import deque
import sys

from PIL import Image


OUTPUT_SIZE = (360, 340)

# Each tuple is (body center x, body baseline y).  A common destination baseline
# keeps the character stable while leaving room for the detached ? / Z glyphs.
FRAMES = {
    "idle": (186, 355),
    "blink": (547, 355),
    "talk": (906, 355),
    "question": (1260, 355),
    "sad": (186, 707),
    "happy": (547, 707),
    "thumbsup": (901, 707),
    "relaxed": (1258, 707),
    "sleep1": (180, 1047),
    "sleep2": (529, 1047),
    "sleep3": (884, 1047),
}


def is_green_screen(red: int, green: int, blue: int) -> bool:
    """Match the bright green background without consuming dark line art."""
    return green >= 120 and green > red * 1.35 and green > blue * 1.35


def connected_green_screen(frame: Image.Image) -> set[tuple[int, int]]:
    """Flood the bright backdrop, then peel off its one-pixel dark green fringe."""
    width, height = frame.size
    source = frame.load()
    transparent: set[tuple[int, int]] = set()
    queue: deque[tuple[int, int]] = deque()

    for x in range(width):
        queue.extend(((x, 0), (x, height - 1)))
    for y in range(height):
        queue.extend(((0, y), (width - 1, y)))

    while queue:
        x, y = queue.popleft()
        if (x, y) in transparent:
            continue
        red, green, blue, _alpha = source[x, y]
        if not is_green_screen(red, green, blue):
            continue
        transparent.add((x, y))
        for next_y in range(max(0, y - 1), min(height, y + 2)):
            for next_x in range(max(0, x - 1), min(width, x + 2)):
                if (next_x, next_y) not in transparent:
                    queue.append((next_x, next_y))

    fringe: set[tuple[int, int]] = set()
    for x, y in transparent:
        for next_y in range(max(0, y - 1), min(height, y + 2)):
            for next_x in range(max(0, x - 1), min(width, x + 2)):
                red, green, blue, _alpha = source[next_x, next_y]
                if green > red and green > blue:
                    fringe.add((next_x, next_y))
    transparent.update(fringe)

    return transparent


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: extract_pet_sprites.py SOURCE.png OUTPUT_DIR")

    source = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])
    output_dir.mkdir(parents=True, exist_ok=True)
    copy2(source, output_dir / "original-sprite-sheet.png")

    sheet = Image.open(source).convert("RGBA")
    width, height = OUTPUT_SIZE

    for name, (center_x, baseline_y) in FRAMES.items():
        left = center_x - width // 2
        top = baseline_y - 320
        frame = sheet.crop((left, top, left + width, top + height))
        transparent = connected_green_screen(frame)
        pixels = []
        for index, (red, green, blue, _alpha) in enumerate(frame.getdata()):
            coordinate = (index % width, index // width)
            if coordinate in transparent or is_green_screen(red, green, blue):
                pixels.append((0, 0, 0, 0))
            elif green > red and green > blue and green < 120:
                # Neutralize residual green spill in black outlines and glyphs.
                neutral = min(red, blue)
                pixels.append((neutral, neutral, neutral, 255))
            else:
                pixels.append((red, green, blue, 255))
        frame.putdata(pixels)
        frame.save(output_dir / f"{name}.png", optimize=False)


if __name__ == "__main__":
    main()
