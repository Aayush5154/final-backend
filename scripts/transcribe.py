import json
import sys

from faster_whisper import WhisperModel


def main():
    if len(sys.argv) < 2:
        print("usage: transcribe.py <audio-path> [model]", file=sys.stderr)
        sys.exit(2)

    audio_path = sys.argv[1]
    model_name = sys.argv[2] if len(sys.argv) > 2 else "base"

    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    segments, info = model.transcribe(audio_path, vad_filter=True, beam_size=1)

    items = [
        {
            "start": round(segment.start, 2),
            "end": round(segment.end, 2),
            "text": segment.text.strip(),
        }
        for segment in segments
        if segment.text.strip()
    ]

    json.dump(
        {
            "language": info.language,
            "duration": info.duration,
            "segments": items,
            "text": " ".join(item["text"] for item in items).strip(),
        },
        sys.stdout,
        ensure_ascii=False,
    )


if __name__ == "__main__":
    main()
