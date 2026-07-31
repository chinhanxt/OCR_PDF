import os
import uuid
import paddle
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

def get_docling_builder():
    global docling_builder_instance
    if docling_builder_instance is None:
        from docling_builder import DoclingBuilder
        docling_builder_instance = DoclingBuilder()
    return docling_builder_instance

def run_pdf_job(task_id: str, upload_path: str, output_path: str, task_pages_dir: str, filename: str, engine: str):
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
        else:
            result = pdf_builder.process_pdf(upload_path, output_path, task_pages_dir, progress_callback=on_progress)

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
        "engines": ["paddleocr", "docling"]
    }

@app.post("/api/scan")
async def scan_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    engine: str = Form("paddleocr")
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
        engine
    )

    return {"task_id": task_id, "status": "processing", "engine": engine}

@app.get("/api/task/{task_id}")
def get_task_status(task_id: str):
    if task_id not in tasks_store:
        raise HTTPException(status_code=404, detail="Task not found")
    return tasks_store[task_id]
