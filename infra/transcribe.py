#!/usr/bin/env python3
import sys
from faster_whisper import WhisperModel
model = WhisperModel("small", device="cpu", compute_type="int8")
segments, info = model.transcribe(sys.argv[1], vad_filter=True)
print(" ".join(s.text.strip() for s in segments))
