"""Generate the 15 Mandarin narration WAV files.

Requires Python 3 with edge-tts (pip install edge-tts) and ffmpeg on PATH.
Voice: zh-CN-XiaoxiaoNeural (Xiaoxiao), the Microsoft neural voice most widely used
for Mandarin narration and guide content, far more natural than SAPI voices.
Rate -5% and EBU R128 loudness normalization to -16 LUFS / -1.5 dBTP keep every
clip at a consistent playback volume on a phone speaker.
"""

import argparse
import asyncio
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import edge_tts

SCRIPT_DIR = Path(__file__).resolve().parent
TARGET_DIR = (SCRIPT_DIR / ".." / "public" / "media" / "narrations").resolve()


def load_manifest():
    result = subprocess.run(
        ["node", str(SCRIPT_DIR / "tts-manifest.js")],
        capture_output=True,
        check=True,
    )
    return json.loads(result.stdout.decode("utf-8"))


async def synthesize(text, target, voice, rate, attempts=6, timeout=60):
    for attempt in range(1, attempts + 1):
        try:
            target.unlink(missing_ok=True)
            await asyncio.wait_for(
                edge_tts.Communicate(text, voice, rate=rate).save(str(target)),
                timeout=timeout,
            )
            if target.exists() and target.stat().st_size > 0:
                return
            raise RuntimeError("empty audio")
        except Exception as error:  # noqa: BLE001 - edge-tts fails intermittently
            print(f"  attempt {attempt} failed: {error}", file=sys.stderr)
            await asyncio.sleep(1.5 * attempt)
    raise RuntimeError(f"Speech synthesis failed: {target.name}")


def measure_loudness(path):
    result = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-nostats",
            "-i",
            str(path),
            "-af",
            "loudnorm=I=-16:TP=-1.5:print_format=json",
            "-f",
            "null",
            "-",
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    output = result.stderr
    start = output.rfind("{")
    end = output.rfind("}")
    if start < 0 or end < start:
        raise RuntimeError(f"Cannot measure loudness: {path.name}")
    return json.loads(output[start : end + 1])


def encode_wav(mp3, target, measured):
    audio_filter = (
        "loudnorm=I=-16:TP=-1.5:LRA=11"
        f":measured_I={measured['input_i']}"
        f":measured_TP={measured['input_tp']}"
        f":measured_LRA={measured['input_lra']}"
        f":measured_thresh={measured['input_thresh']}"
        ":offset=0:linear=true"
    )
    subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(mp3),
            "-af",
            audio_filter,
            "-ar",
            "24000",
            "-ac",
            "1",
            "-c:a",
            "pcm_s16le",
            str(target),
        ],
        check=True,
    )
    header = target.read_bytes()[:12]
    if header[:4] != b"RIFF" or header[8:12] != b"WAVE":
        raise RuntimeError(f"Invalid WAV header: {target.name}")


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--voice", default="", help="Override the per-language voice from the manifest.")
    parser.add_argument("--rate", default="-5%")
    parser.add_argument("--languages", default="", help="Comma separated language codes, e.g. yue,en. Default: all.")
    args = parser.parse_args()

    manifest = load_manifest()
    if not manifest:
        raise RuntimeError("The narration manifest is empty.")
    if args.languages:
        wanted = {code.strip() for code in args.languages.split(",") if code.strip()}
        manifest = [item for item in manifest if item["languageCode"] in wanted]
        if not manifest:
            raise RuntimeError(f"No narration items match languages: {args.languages}")

    TARGET_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="jinlou-narration-") as work:
        work_dir = Path(work)
        for item in manifest:
            voice = args.voice or item.get("voice")
            if not voice:
                raise RuntimeError(f"No voice configured for {item['filename']}")
            mp3 = work_dir / f"{item['id']}.mp3"
            target = TARGET_DIR / item["filename"]
            await synthesize(item["text"], mp3, voice, args.rate)
            encode_wav(mp3, target, measure_loudness(mp3))
            print(f"ok: {item['filename']} ({voice})")

    print(f"Narration audio generated: {len(manifest)} files (rate {args.rate})")


if __name__ == "__main__":
    asyncio.run(main())

