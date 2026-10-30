"""Cut a green-screen animation strip into frames that line up with the pet sprites.

AI-generated strips come at their own scale and position, so every frame is
rescaled by ONE shared factor (from the first frame vs. the reference frame)
and placed so its feet sit exactly where the reference hamster's feet are.

usage: extract_pet_animation.py STRIP.png REFERENCE.png OUTPUT_DIR NAME_PREFIX
  writes OUTPUT_DIR/NAME_PREFIX1.png ... in left-to-right order.
"""

from pathlib import Path
import sys

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from extract_pet_sprites import connected_green_screen, is_green_screen  # noqa: E402

MIN_FRAME_WIDTH = 80
FEET_BAND = 24


def frame_columns(strip: Image.Image) -> list[tuple[int, int]]:
    """Left/right x of each frame, split by fully green columns."""
    width, height = strip.size
    pixels = strip.load()
    filled = [
        any(not is_green_screen(*pixels[x, y][:3]) for y in range(0, height, 2))
        for x in range(width)
    ]
    runs: list[tuple[int, int]] = []
    start = None
    for x, has_art in enumerate(filled + [False]):
        if has_art and start is None:
            start = x
        elif not has_art and start is not None:
            if x - start >= MIN_FRAME_WIDTH:
                runs.append((start, x - 1))
            start = None
    return runs


def key_out_green(frame: Image.Image) -> Image.Image:
    """Same green-screen removal and spill cleanup as extract_pet_sprites.py."""
    frame = frame.convert("RGBA")
    width, _height = frame.size
    transparent = connected_green_screen(frame)
    pixels = []
    for index, (red, green, blue, _alpha) in enumerate(frame.getdata()):
        if (index % width, index // width) in transparent or is_green_screen(red, green, blue):
            pixels.append((0, 0, 0, 0))
        elif green > red and green > blue and green < 120:
            neutral = min(red, blue)
            pixels.append((neutral, neutral, neutral, 255))
        else:
            pixels.append((red, green, blue, 255))
    frame.putdata(pixels)
    return frame


def feet_center_x(image: Image.Image) -> float:
    """Horizontal center of the bottom band, so raised arms don't shift the body."""
    box = image.getchannel("A").getbbox()
    if box is None:
        raise ValueError("empty frame")
    pixels = image.load()
    xs = [
        x
        for y in range(box[3] - FEET_BAND, box[3])
        for x in range(box[0], box[2])
        if pixels[x, y][3] > 0
    ]
    return sum(xs) / len(xs)


def main() -> None:
    if len(sys.argv) != 5:
        raise SystemExit(
            "usage: extract_pet_animation.py STRIP.png REFERENCE.png OUTPUT_DIR NAME_PREFIX"
        )
    strip = Image.open(sys.argv[1]).convert("RGBA")
    reference = Image.open(sys.argv[2]).convert("RGBA")
    output_dir = Path(sys.argv[3])
    prefix = sys.argv[4]
    output_dir.mkdir(parents=True, exist_ok=True)

    reference_box = reference.getchannel("A").getbbox()
    reference_height = reference_box[3] - reference_box[1]
    reference_feet_x = feet_center_x(reference)
    canvas_size = reference.size

    frames = []
    for left, right in frame_columns(strip):
        frame = key_out_green(strip.crop((left, 0, right + 1, strip.height)))
        frames.append(frame.crop(frame.getchannel("A").getbbox()))

    # One shared scale keeps the frames the same size relative to each other.
    scale = reference_height / frames[0].height
    for index, frame in enumerate(frames, start=1):
        size = (round(frame.width * scale), round(frame.height * scale))
        resized = frame.convert("RGBa").resize(size, Image.LANCZOS).convert("RGBA")
        # Hard alpha edge, matching the existing sprites (fully opaque or fully clear).
        alpha = resized.getchannel("A").point(lambda value: 255 if value >= 128 else 0)
        resized.putalpha(alpha)

        canvas = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
        x = round(reference_feet_x - feet_center_x(resized))
        y = reference_box[3] - resized.height
        canvas.alpha_composite(resized, (x, y))
        canvas.save(output_dir / f"{prefix}{index}.png")
        print(f"{prefix}{index}.png  offset=({x}, {y})  size={size}")
    print(f"scale={scale:.4f}  frames={len(frames)}")


if __name__ == "__main__":
    main()
