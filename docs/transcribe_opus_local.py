#!/usr/bin/env python3
"""Batch-transcribe .opus files to .txt locally using faster-whisper.

Examples:
  python3 transcribe_opus_local.py ./whatsapp --skip-existing
  python3 transcribe_opus_local.py ./whatsapp --model-size small --output-dir ./transcripts
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Iterable


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Batch-transcribe .opus audio files locally (no API cost)."
    )
    parser.add_argument(
        "input_path",
        type=Path,
        help="Path to one audio file or a directory with .opus files",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Directory to write transcripts (preserves relative structure for directories)",
    )
    parser.add_argument(
        "--glob",
        default="*.opus",
        help="Glob pattern for directory input (default: *.opus)",
    )
    parser.add_argument(
        "--recursive",
        dest="recursive",
        action="store_true",
        default=True,
        help="Search directories recursively (default: enabled)",
    )
    parser.add_argument(
        "--no-recursive",
        dest="recursive",
        action="store_false",
        help="Disable recursive search",
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip files where output .txt already exists",
    )
    parser.add_argument(
        "--model-size",
        default="small",
        choices=["tiny", "base", "small", "medium", "large-v3", "large-v3-turbo"],
        help="Whisper model size (default: small)",
    )
    parser.add_argument(
        "--device",
        default="auto",
        help="Device to use: auto, cpu, or cuda (default: auto)",
    )
    parser.add_argument(
        "--compute-type",
        default="int8",
        help="Compute type, e.g. int8, int8_float16, float16, float32 (default: int8)",
    )
    parser.add_argument(
        "--language",
        default=None,
        help="Force language code (e.g. en, es). Default: auto-detect",
    )
    parser.add_argument(
        "--beam-size",
        type=int,
        default=5,
        help="Beam size for decoding (default: 5)",
    )
    parser.add_argument(
        "--initial-prompt",
        default=None,
        help="Optional context prompt to improve domain accuracy",
    )
    parser.add_argument(
        "--timestamps",
        action="store_true",
        help="Include segment timestamps in output .txt",
    )
    parser.add_argument(
        "--no-vad-filter",
        dest="vad_filter",
        action="store_false",
        default=True,
        help="Disable voice activity detection filter",
    )
    return parser.parse_args()


def collect_audio_files(input_path: Path, pattern: str, recursive: bool) -> list[Path]:
    if not input_path.exists():
        raise FileNotFoundError(f"Input path does not exist: {input_path}")
    if input_path.is_file():
        return [input_path]

    matcher = input_path.rglob if recursive else input_path.glob
    return sorted(p for p in matcher(pattern) if p.is_file())


def output_path_for(audio_path: Path, input_path: Path, output_dir: Path | None) -> Path:
    if output_dir is None:
        return audio_path.with_suffix(".txt")

    if input_path.is_dir():
        rel = audio_path.relative_to(input_path)
        base = output_dir / rel
    else:
        base = output_dir / audio_path.name

    return base.with_suffix(".txt")


def fmt_ts(seconds: float) -> str:
    total_ms = int(seconds * 1000)
    hours = total_ms // 3_600_000
    total_ms %= 3_600_000
    minutes = total_ms // 60_000
    total_ms %= 60_000
    secs = total_ms // 1000
    ms = total_ms % 1000
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{ms:03d}"


def build_text(segments: Iterable[object], with_timestamps: bool) -> str:
    lines: list[str] = []
    for seg in segments:
        text = (getattr(seg, "text", "") or "").strip()
        if not text:
            continue

        if with_timestamps:
            start = float(getattr(seg, "start", 0.0) or 0.0)
            end = float(getattr(seg, "end", 0.0) or 0.0)
            lines.append(f"[{fmt_ts(start)} --> {fmt_ts(end)}] {text}")
        else:
            lines.append(text)

    return "\n".join(lines).strip()


def main() -> int:
    args = parse_args()

    try:
        files = collect_audio_files(args.input_path, args.glob, args.recursive)
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2

    if not files:
        print("No matching audio files found.")
        return 0

    if args.output_dir is not None:
        args.output_dir.mkdir(parents=True, exist_ok=True)

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print(
            "Missing dependency: faster-whisper. Install with: pip install faster-whisper",
            file=sys.stderr,
        )
        return 2

    print(
        f"Loading model '{args.model_size}' on device='{args.device}' compute_type='{args.compute_type}'..."
    )
    model = WhisperModel(
        args.model_size,
        device=args.device,
        compute_type=args.compute_type,
    )

    total = len(files)
    ok = 0
    skipped = 0
    failed = 0

    print(f"Found {total} file(s). Starting transcription...")

    for idx, audio_path in enumerate(files, start=1):
        out_path = output_path_for(audio_path, args.input_path, args.output_dir)

        if args.skip_existing and out_path.exists():
            skipped += 1
            print(f"[{idx}/{total}] SKIP {audio_path} (output exists)")
            continue

        out_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            segments, info = model.transcribe(
                str(audio_path),
                language=args.language,
                beam_size=args.beam_size,
                vad_filter=args.vad_filter,
                initial_prompt=args.initial_prompt,
            )
            text = build_text(segments, args.timestamps)

            if not text:
                raise RuntimeError("Empty transcript output")

            out_path.write_text(text + "\n", encoding="utf-8")
            ok += 1
            detected_lang = getattr(info, "language", "?")
            print(f"[{idx}/{total}] OK   {audio_path} -> {out_path} (lang={detected_lang})")

        except Exception as exc:
            failed += 1
            print(f"[{idx}/{total}] FAIL {audio_path}: {exc}", file=sys.stderr)

    print(f"Done. ok={ok} skipped={skipped} failed={failed}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
