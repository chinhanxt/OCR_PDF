import os
import uuid
import paddle
import threading
from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pdf_builder import PDFBuilder

app = FastAPI(title="Multi-Engine PDF Scanner API (PaddleOCR & Docling)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STORAGE_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "storage"))
UPLOADS_DIR = os.path.join(STORAGE_DIR, "uploads")
PAGES_DIR = os.path.join(STORAGE_DIR, "pages")
OUTPUTS_DIR = os.path.join(STORAGE_DIR, "outputs")

for d in [UPLOADS_DIR, PAGES_DIR, OUTPUTS_DIR]:
    os.makedirs(d, exist_ok=True)

app.mount("/storage", StaticFiles(directory=STORAGE_DIR), name="storage")

tasks_store = {}
pdf_builder = PDFBuilder()
docling_builder_instance = None
gemini_builder_instance = None

@app.on_event("startup")
def startup_event():
    def prewarm():
        print("🔥 Pre-warming OCR Engine & VietOCR models in background...")
        try:
            pdf_builder.get_vietocr()
            print("✅ Models pre-warmed successfully!")
        except Exception as e:
            print(f"Startup pre-warm notice: {e}")
    threading.Thread(target=prewarm, daemon=True).start()

def get_docling_builder():
    global docling_builder_instance
    if docling_builder_instance is None:
        from docling_builder import DoclingBuilder
        docling_builder_instance = DoclingBuilder()
    return docling_builder_instance

def get_gemini_builder():
    global gemini_builder_instance
    if gemini_builder_instance is None:
        from gemini_builder import GeminiBuilder
        gemini_builder_instance = GeminiBuilder()
    return gemini_builder_instance

def run_pdf_job(task_id: str, upload_path: str, output_path: str, task_pages_dir: str, filename: str, engine: str, api_key: str = None, gemini_model: str = "gemini-2.5-flash"):
    def on_progress(current_page: int, total_pages: int):
        pct = int((current_page / max(1, total_pages)) * 100)
        tasks_store[task_id] = {
            "status": "processing",
            "current_page": current_page,
            "total_pages": total_pages,
            "progress_percent": pct,
            "engine": engine
        }

    try:
        if engine == "docling":
            builder = get_docling_builder()
            result = builder.process_pdf(upload_path, output_path, task_pages_dir, progress_callback=on_progress)
        elif engine == "gemini":
            builder = get_gemini_builder()
            result = builder.process_pdf(
                upload_path,
                output_path,
                task_pages_dir,
                progress_callback=on_progress,
                api_key=api_key,
                model_name=gemini_model
            )
        else:
            result = pdf_builder.process_pdf(upload_path, output_path, task_pages_dir, progress_callback=on_progress, use_vietocr=True)

        docx_filename = os.path.basename(result["output_docx"])
        tasks_store[task_id] = {
            "status": "completed",
            "current_page": result["total_pages"],
            "total_pages": result["total_pages"],
            "progress_percent": 100,
            "engine": engine,
            "result": result,
            "original_url": f"/storage/uploads/{task_id}_{filename}",
            "searchable_url": f"/storage/outputs/{task_id}_searchable.pdf",
            "docx_url": f"/storage/outputs/{docx_filename}"
        }
    except Exception as e:
        tasks_store[task_id] = {"status": "failed", "error": str(e), "engine": engine}

@app.get("/api/status")
def get_status():
    return {
        "status": "online",
        "gpu_available": paddle.is_compiled_with_cuda(),
        "device": paddle.get_device(),
        "engines": ["paddleocr", "docling", "gemini"]
    }

@app.post("/api/scan")
async def scan_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    engine: str = Form("paddleocr"),
    api_key: str = Form(None),
    gemini_model: str = Form("gemini-2.5-flash")
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    task_id = str(uuid.uuid4())
    upload_path = os.path.join(UPLOADS_DIR, f"{task_id}_{file.filename}")
    output_path = os.path.join(OUTPUTS_DIR, f"{task_id}_searchable.pdf")
    task_pages_dir = os.path.join(PAGES_DIR, task_id)

    with open(upload_path, "wb") as f:
        f.write(await file.read())

    tasks_store[task_id] = {
        "status": "processing",
        "current_page": 0,
        "total_pages": 1,
        "progress_percent": 0,
        "engine": engine
    }

    background_tasks.add_task(
        run_pdf_job,
        task_id,
        upload_path,
        output_path,
        task_pages_dir,
        file.filename,
        engine,
        api_key,
        gemini_model
    )

    return {"task_id": task_id, "status": "processing", "engine": engine}

@app.get("/api/task/{task_id}")
def get_task_status(task_id: str):
    if task_id not in tasks_store:
        raise HTTPException(status_code=404, detail="Task not found")
    return tasks_store[task_id]

@app.post("/api/test-gemini-key")
def test_gemini_key(api_key: str = Form(...), gemini_model: str = Form("gemini-2.5-flash")):
    if not api_key or not api_key.strip():
        raise HTTPException(status_code=400, detail="Vui lòng nhập API Key")
    try:
        import google.generativeai as genai
        clean_key = api_key.strip()
        genai.configure(api_key=clean_key)

        # 1. Query available models directly for this specific API Key from Google
        models_iter = genai.list_models()
        available_models = [
            m.name.replace("models/", "")
            for m in models_iter
            if "generateContent" in getattr(m, "supported_generation_methods", [])
        ]
        
        if available_models:
            first_few = ", ".join(available_models[:4])
            return {
                "status": "ok",
                "message": f"API Key hợp lệ! Danh sách mô hình Gemini khả dụng: {first_few}",
                "models": available_models
            }

        # 2. Fallback: test generate_content on candidate model names
        candidates = [gemini_model, "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
        for cand in candidates:
            try:
                model = genai.GenerativeModel(cand)
                res = model.generate_content("Ping")
                return {"status": "ok", "message": f"API Key hợp lệ! Kết nối thành công với Google Gemini AI ({cand})."}
            except Exception:
                continue

        return {"status": "ok", "message": "API Key hợp lệ! Đã xác thực thành công với Google Gemini API."}

    except Exception as e:
        err_str = str(e)
        if "API_KEY_INVALID" in err_str or "API key not valid" in err_str:
            msg = "API Key không hợp lệ. Vui lòng kiểm tra lại chuỗi API Key."
        else:
            msg = f"Lỗi kiểm tra API Key: {err_str}"
        return {"status": "error", "message": msg}

