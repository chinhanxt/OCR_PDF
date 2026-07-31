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

@app.get("/api/status")
def get_status():
    return {
        "status": "online",
        "gpu_available": paddle.is_compiled_with_cuda(),
        "device": paddle.get_device()
    }

@app.post("/api/scan")
async def scan_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    task_id = str(uuid.uuid4())
    upload_path = os.path.join(UPLOADS_DIR, f"{task_id}_{file.filename}")
    output_path = os.path.join(OUTPUTS_DIR, f"{task_id}_searchable.pdf")
    task_pages_dir = os.path.join(PAGES_DIR, task_id)

    with open(upload_path, "wb") as f:
        f.write(await file.read())

    try:
        result = pdf_builder.process_pdf(upload_path, output_path, task_pages_dir)
        tasks_store[task_id] = {
            "status": "completed",
            "result": result,
            "original_url": f"/storage/uploads/{task_id}_{file.filename}",
            "searchable_url": f"/storage/outputs/{task_id}_searchable.pdf"
        }
        return {"task_id": task_id, "status": "completed", "data": tasks_store[task_id]}
    except Exception as e:
        tasks_store[task_id] = {"status": "failed", "error": str(e)}
        raise HTTPException(status_code=500, detail=str(e))
