"""Tiến trình xử lý media cục bộ, giao tiếp bằng JSON Lines qua stdin/stdout."""
from __future__ import annotations
import contextlib, hashlib, json, math, shutil, subprocess, sys, tempfile
from pathlib import Path

for stream in (sys.stdin, sys.stdout, sys.stderr):
    if hasattr(stream, "reconfigure"):
        stream.reconfigure(encoding="utf-8")

class WorkerFailure(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message); self.code = code

def log(message: str) -> None:
    print(message, file=sys.stderr, flush=True)

def respond(request_id: str, success: bool, data=None, code=None, message=None) -> None:
    error = None if success else {"code": code or "WORKER_ERROR", "message": message or "Lỗi worker"}
    sys.stdout.write(json.dumps({"requestId": request_id, "success": success, "data": data or {}, "error": error}, ensure_ascii=False) + "\n")
    sys.stdout.flush()

def missing(name: str, install: str, error: Exception) -> WorkerFailure:
    return WorkerFailure("DEPENDENCY_MISSING", f"Thiếu {name}. Cài bằng: {install}. Chi tiết: {error}")

def metadata(path, options):
    result = subprocess.run([options.get("ffprobePath", "ffprobe"), "-v", "error", "-print_format", "json", "-show_format", "-show_streams", path], capture_output=True, text=True, check=True)
    return json.loads(result.stdout)

def keyframes(path, options):
    output = options.get("outputDir") or tempfile.mkdtemp(prefix="htcv-"); Path(output).mkdir(parents=True, exist_ok=True)
    pattern = str(Path(output) / "frame-%02d.jpg")
    subprocess.run([options.get("ffmpegPath", "ffmpeg"), "-y", "-i", path, "-vf", "fps=1/5,scale=480:-2", "-frames:v", str(options.get("count", 8)), pattern], check=True, capture_output=True)
    return {"paths": [str(p) for p in sorted(Path(output).glob("frame-*.jpg"))]}

def digest(path, size=None):
    value = hashlib.sha256()
    with open(path, "rb") as stream:
        while chunk := stream.read(1024 * 1024 if size is None else min(size, 1024 * 1024)):
            value.update(chunk)
            if size is not None:
                size -= len(chunk)
                if size <= 0: break
    return value.hexdigest()

def transcribe(path, options):
    try: from faster_whisper import WhisperModel
    except ImportError as error: raise missing("faster-whisper", "python -m pip install faster-whisper", error)
    model_path = options.get("modelPath")
    if not model_path or not Path(model_path).exists(): raise WorkerFailure("DEPENDENCY_MISSING", "Chưa có mô hình Whisper cục bộ. Hãy đặt options.modelPath tới thư mục model đã tải thủ công.")
    model = WhisperModel(model_path, device=options.get("device", "cpu"), compute_type=options.get("computeType", "int8"), local_files_only=True)
    segments, info = model.transcribe(path, vad_filter=True)
    rows = [{"start": item.start, "end": item.end, "text": item.text.strip()} for item in segments]
    return {"text": " ".join(item["text"] for item in rows), "segments": rows, "language": info.language}

def ocr(path, options):
    try: import cv2, pytesseract
    except ImportError as error: raise missing("opencv-python-headless/pytesseract", "python -m pip install opencv-python-headless pytesseract", error)
    executable = options.get("tesseractPath") or shutil.which("tesseract") or r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    if not Path(executable).exists(): raise WorkerFailure("DEPENDENCY_MISSING", "Thiếu Tesseract OCR executable. Hãy cài Tesseract và thêm vào PATH.")
    pytesseract.pytesseract.tesseract_cmd = executable
    capture = cv2.VideoCapture(path); texts = []; fps = max(capture.get(cv2.CAP_PROP_FPS), 1); frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    for position in range(0, frame_count, max(1, int(fps * 5))):
        capture.set(cv2.CAP_PROP_POS_FRAMES, position); ok, frame = capture.read()
        if ok:
            text = pytesseract.image_to_string(frame, lang=options.get("language", "vie+eng")).strip()
            if text: texts.append(text)
    capture.release(); return {"text": "\n".join(dict.fromkeys(texts))}

def image_embedding(path, options):
    try:
        import open_clip, torch
        from PIL import Image
    except ImportError as error: raise missing("OpenCLIP/PyTorch/Pillow", "python -m pip install open-clip-torch torch Pillow", error)
    checkpoint = options.get("checkpointPath")
    if not checkpoint or not Path(checkpoint).exists(): raise WorkerFailure("DEPENDENCY_MISSING", "Chưa có checkpoint OpenCLIP cục bộ. Hãy đặt options.checkpointPath tới tệp model đã tải thủ công.")
    model, _, preprocess = open_clip.create_model_and_transforms(options.get("model", "ViT-B-32"), pretrained=checkpoint)
    with torch.no_grad():
        vector = model.encode_image(preprocess(Image.open(path)).unsqueeze(0)); vector /= vector.norm(dim=-1, keepdim=True)
    return {"embedding": vector[0].cpu().tolist()}

def text_embedding(text, options):
    try: from sentence_transformers import SentenceTransformer
    except ImportError as error: raise missing("sentence-transformers", "python -m pip install sentence-transformers", error)
    model_path = options.get("modelPath")
    if not model_path or not Path(model_path).exists(): raise WorkerFailure("DEPENDENCY_MISSING", "Chưa có text embedding model cục bộ. Hãy đặt options.modelPath tới thư mục model đã tải thủ công.")
    vector = SentenceTransformer(model_path, local_files_only=True).encode(text, normalize_embeddings=True)
    return {"embedding": vector.tolist()}

def compare(_, options):
    first, second = options.get("a", []), options.get("b", [])
    if not first or len(first) != len(second): return {"similarity": 0}
    dot = sum(a * b for a, b in zip(first, second)); norm = math.sqrt(sum(x*x for x in first) * sum(x*x for x in second))
    return {"similarity": dot / norm if norm else 0}

OPERATIONS = {
    "ping": lambda _path, _options: {"status": "ok", "protocolVersion": 1},
    "analyze_metadata": metadata, "extract_keyframes": keyframes,
    "compute_perceptual_hash": lambda path, _options: {"hash": digest(path)},
    "compute_audio_fingerprint": lambda path, _options: {"fingerprint": digest(path, 4_000_000)},
    "transcribe": transcribe, "transcribe_audio": transcribe,
    "ocr": ocr, "run_ocr": ocr,
    "embedding": image_embedding, "create_image_embedding": image_embedding,
    "create_text_embedding": lambda path, options: text_embedding(options.get("text", path), options),
    "compare_features": compare,
}

def dispatch(request):
    operation = request.get("operation")
    if operation == "extract_audio":
        options = request.get("options", {}); output = options.get("outputPath") or tempfile.mktemp(suffix=".wav")
        subprocess.run([options.get("ffmpegPath", "ffmpeg"), "-y", "-i", request.get("inputPath", ""), "-vn", "-ac", "1", "-ar", "16000", output], check=True, capture_output=True)
        return {"path": output}
    handler = OPERATIONS.get(operation)
    if not handler: raise WorkerFailure("UNSUPPORTED_OPERATION", f"Tác vụ không được hỗ trợ: {operation}")
    return handler(request.get("inputPath", ""), request.get("options", {}))

def main():
    log("Python media worker đã khởi động")
    for line in sys.stdin:
        request_id = "unknown"
        try:
            request = json.loads(line); request_id = str(request.get("requestId", "unknown"))
            if not request.get("requestId") or not request.get("operation"): raise WorkerFailure("INVALID_REQUEST", "Thiếu requestId hoặc operation")
            with contextlib.redirect_stdout(sys.stderr):
                data = dispatch(request)
            respond(request_id, True, data)
        except json.JSONDecodeError as error: respond(request_id, False, code="INVALID_JSON", message=f"JSON request không hợp lệ: {error}")
        except WorkerFailure as error: respond(request_id, False, code=error.code, message=str(error))
        except Exception as error:
            log(f"Lỗi kỹ thuật requestId={request_id}: {error}"); respond(request_id, False, code="WORKER_ERROR", message=str(error))

if __name__ == "__main__": main()
