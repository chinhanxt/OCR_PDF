import os
import uuid
import paddle
from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pdf_builder import PDFBuilder

app = FastAPI(title="PaddleOCR PDF Scanner API")

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

def run_pdf_job(task_id: str, upload_path: str, output_path: str, task_pages_dir: str, filename: str):
    def on_progress(current_page: int, total_pages: int):
        pct = int((current_page / max(1, total_pages)) * 100)
        tasks_store[task_id] = {
            "status": "processing",
            "current_page": current_page,
            "total_pages": total_pages,
            "progress_percent": pct
        }

    try:
        result = pdf_builder.process_pdf(
            upload_path,
            output_path,
            task_pages_dir,
            progress_callback=on_progress
        )
        tasks_store[task_id] = {
            "status": "completed",
            "current_page": result["total_pages"],
            "total_pages": result["total_pages"],
            "progress_percent": 100,
            "result": result,
            "original_url": f"/storage/uploads/{task_id}_{filename}",
            "searchable_url": f"/storage/outputs/{task_id}_searchable.pdf"
        }
    except Exception as e:
        tasks_store[task_id] = {"status": "failed", "error": str(e)}

@app.get("/api/status")
def get_status():
    return {
        "status": "online",
        "gpu_available": paddle.is_compiled_with_cuda(),
        "device": paddle.get_device()
    }

@app.post("/api/scan")
async def scan_pdf(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
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
        "progress_percent": 0
    }

    background_tasks.add_task(
        run_pdf_job,
        task_id,
        upload_path,
        output_path,
        task_pages_dir,
        file.filename
    )

    return {"task_id": task_id, "status": "processing"}

@app.get("/api/task/{task_id}")
def get_task_status(task_id: str):
    if task_id not in tasks_store:
        raise HTTPException(status_code=404, detail="Task not found")
    return tasks_store[task_id]
