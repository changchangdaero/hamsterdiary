"""Create exact pixel-art app icons from the extracted idle sprite."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src/renderer/src/assets/pet/pixel/idle.png"
RESOURCES = ROOT / "resources"
PUBLIC = ROOT / "src/renderer/public"


def square_source() -> Image.Image:
    image = Image.open(SOURCE).convert("RGBA")
    bounds = image.getchannel("A").getbbox()
    if bounds is None:
        raise RuntimeError("idle sprite has no visible pixels")
    cropped = image.crop(bounds)
    side = max(cropped.size) + 24
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.alpha_composite(
        cropped,
        ((side - cropped.width) // 2, (side - cropped.height) // 2),
    )
    return canvas


def resized(source: Image.Image, size: int) -> Image.Image:
    return source.resize((size, size), Image.Resampling.NEAREST)


def main() -> None:
    RESOURCES.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    source = square_source()

    resized(source, 256).save(RESOURCES / "window-icon.png")
    resized(source, 64).save(RESOURCES / "tray-icon.png")
    resized(source, 32).save(PUBLIC / "favicon.png")

    ico_source = resized(source, 256)
    ico_source.save(
        RESOURCES / "app-icon.ico",
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64),
               (128, 128), (256, 256)],
    )


if __name__ == "__main__":
    main()
