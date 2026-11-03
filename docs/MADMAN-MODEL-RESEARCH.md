# Model candidates for MadMan Cut

Reviewed 2026-11-02 against the publishers' model cards and this checkout.
An entry below is not a claim that a model is installed or integrated.

## Speech recognition

- **Whisper large-v3-q5_0**: a larger multilingual Whisper model that uses
  the existing whisper.cpp inference path. The optional download is 1,081,140,203
  bytes and is checked against SHA-256 `d75795ecff3f83b5faa89d1900604ad8c780abd5739fae406de19f23ecd98ad1`.
  Source: [whisper.cpp model repository](https://huggingface.co/ggerganov/whisper.cpp/blob/fb5ed9369c26eaf08392504d8446da431e0fffb9/ggml-large-v3-q5_0.bin).
  It requires more memory and may be slower than turbo; accuracy on a particular
  recording must be checked, and the existing turbo recommendation remains.
- **NVIDIA Parakeet TDT 0.6B v3** supports Czech and Slovak, includes word
  timestamps and is CC BY 4.0 according to its [publisher's model card](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3).
  Its architecture is not a Whisper GGML model; integrating it needs another
  runtime, model/notice packaging, timestamp mapping, cancellation and Windows
  CPU/GPU testing. It is not added to the model picker.
- **Qwen3-ASR** supports Czech and uses Apache-2.0 according to its [publisher's model card](https://huggingface.co/Qwen/Qwen3-ASR-1.7B).
  It requires a different inference runtime. Its separately documented forced
  aligner does not list Czech, so word timing would need independent validation
  or the existing Czech aligner. It is not added to the model picker.

## Editing assistance

- **SAM 2.1** can segment objects across video frames; its [small model card](https://huggingface.co/facebook/sam2.1-hiera-small)
  states Apache-2.0. This would require a separate interactive mask/tracking
  workflow and GPU/memory tests; the existing person segmentation is not SAM 2.1.
- **pyannote Community-1** is a candidate for speaker-separated transcripts.
  Its [official instructions](https://github.com/pyannote/pyannote-audio) require
  accepting model conditions and a Hugging Face token; the Python/PyTorch stack,
  privacy settings, timing and license notices would need integration work.
  It is not bundled or activated.

Compare speech models on the user's own representative Czech recordings before
claiming an accuracy or speed improvement. Offline inference still requires a
one-time model download, and every model must be tested against the current
Windows runtime, available memory and cancellation path.
