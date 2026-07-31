# PDF OCR Web Application Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a high-precision, GPU-accelerated PDF OCR Web Application using PaddleOCR (from `/home/chinhan/Scan_PDF/PaddleOCR`) that converts scanned/image-based PDFs into Searchable PDFs (with invisible text layer over exact bbox coordinates) and provides a 1-vs-1 side-by-side dual viewer and interactive HTML field inspector.

**Architecture:** A FastAPI backend uses PyMuPDF (fitz) to convert PDF pages to 300 DPI images, runs GPU-accelerated PaddleOCR (with `lang='vi'`, `use_gpu=True`, `use_angle_cls=True`) for text and table extraction, and overlays invisible text onto original page images to construct a Searchable PDF. The React/Vite frontend renders a split-screen 1-vs-1 synchronized PDF viewer and an interactive HTML layout editor.

**Tech Stack:** Python 3.10+, FastAPI, PyMuPDF (fitz), PaddleOCR, PaddlePaddle GPU (CUDA 12.8), React 18, Vite, Tailwind CSS, Lucide React.

## Global Constraints

- Project Root: `/home/chinhan/Scan_PDF`
- PaddleOCR Repo: `/home/chinhan/Scan_PDF/PaddleOCR`
- Test PDF: `/home/chinhan/Downloads/1. TTr_PTAP_daduyet_250725.pdf`
- GPU: NVIDIA GeForce RTX 3050 Laptop GPU (CUDA 12.8)

---

### Task 1: Backend Environment Setup & OCR Engine Module

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/ocr_engine.py`
- Test: `backend/tests/test_ocr_engine.py`

**Interfaces:**
- Produces: `OCREngine.scan_image(image_path: str) -> List[dict]` returning `[{'bbox': [x0,y0,x1,y1], 'text': str, 'confidence': float}]`

- [ ] **Step 1: Create backend requirements.txt and install packages**

```text
fastapi>=0.100.0
uvicorn>=0.22.0
pymupdf>=1.22.0
paddleocr>=2.7.0
paddlepaddle-gpu>=2.5.0
pillow>=9.5.0
python-multipart>=0.0.6
pytest>=7.0.0
```

- [ ] **Step 2: Create unit test for OCREngine**

```python
# backend/tests/test_ocr_engine.py
import os
import pytest
from PIL import Image, ImageDraw, ImageFont
from ocr_engine import OCREngine

def test_ocr_engine_gpu_and_detection(tmp_path):
    # Create test image with Vietnamese text
    img_path = str(tmp_path / "test_ocr.png")
    img = Image.new('RGB', (400, 100), color=(255, 255, 255))
    d = ImageDraw.Draw(img)
    d.text((20, 30), "Cong viec 1.3: Phat trien", fill=(0, 0, 0))
    img.save(img_path)

    engine = OCREngine()
    results = engine.scan_image(img_path)
    assert len(results) > 0
    assert any("Cong viec" in r["text"] or "Phat trien" in r["text"] for r in results)
```

- [ ] **Step 3: Implement OCREngine wrapper with GPU support**

```python
# backend/ocr_engine.py
import sys
import os
from typing import List, Dict, Any

# Ensure local PaddleOCR package is importable
paddleocr_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "PaddleOCR"))
if paddleocr_path not in sys.path:
    sys.path.insert(0, paddleocr_path)

from paddleocr import PaddleOCR

class OCREngine:
    def __init__(self, use_gpu: bool = True):
        self.ocr = PaddleOCR(
            use_angle_cls=True,
            lang='vi',
            use_gpu=use_gpu,
            show_log=False
        )

    def scan_image(self, image_path: str) -> List[Dict[str, Any]]:
        result = self.ocr.ocr(image_path, cls=True)
        items = []
        if result and result[0]:
            for line in result[0]:
                bbox = line[0]  # [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
                text, confidence = line[1]
                x_coords = [p[0] for p in bbox]
                y_coords = [p[1] for p in bbox]
                items.append({
                    "bbox": [min(x_coords), min(y_coords), max(x_coords), max(y_coords)],
                    "text": text,
                    "confidence": float(confidence)
                })
        return items
```

- [ ] **Step 4: Run test to verify GPU OCR engine**

Run: `cd /home/chinhan/Scan_PDF/backend && pytest tests/test_ocr_engine.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/requirements.txt backend/ocr_engine.py backend/tests/test_ocr_engine.py
git commit -m "feat: implement GPU-accelerated PaddleOCR engine module"
```

---

### Task 2: PDF Builder & Searchable PDF Generator Module

**Files:**
- Create: `backend/pdf_builder.py`
- Test: `backend/tests/test_pdf_builder.py`

**Interfaces:**
- Consumes: `OCREngine.scan_image`
- Produces: `PDFBuilder.build_searchable_pdf(input_pdf_path: str, output_pdf_path: str) -> Dict` containing page metadata and searchable PDF generation.

- [ ] **Step 1: Create unit test for PDFBuilder**

```python
# backend/tests/test_pdf_builder.py
import os
import fitz
import pytest
from pdf_builder import PDFBuilder

def test_pdf_conversion_and_searchable_build(tmp_path):
    # Create sample PDF
    sample_pdf = str(tmp_path / "sample.pdf")
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text((50, 50), "Test Document Title")
    doc.save(sample_pdf)
    doc.close()

    output_pdf = str(tmp_path / "output_searchable.pdf")
    builder = PDFBuilder()
    metadata = builder.process_pdf(sample_pdf, output_pdf)

    assert os.path.exists(output_pdf)
    assert len(metadata["pages"]) == 1
    assert "page_number" in metadata["pages"][0]
```

- [ ] **Step 2: Implement PDFBuilder module using PyMuPDF (fitz)**

```python
# backend/pdf_builder.py
import fitz  # PyMuPDF
import os
from typing import List, Dict, Any
from ocr_engine import OCREngine

class PDFBuilder:
    def __init__(self):
        self.ocr_engine = OCREngine(use_gpu=True)

    def process_pdf(self, input_pdf_path: str, output_pdf_path: str, pages_dir: str = None) -> Dict[str, Any]:
        doc = fitz.open(input_pdf_path)
        out_doc = fitz.open()
        pages_metadata = []

        if pages_dir and not os.path.exists(pages_dir):
            os.makedirs(pages_dir, exist_ok=True)

        for page_idx in range(len(doc)):
            page = doc[page_idx]
            # Render page to 300 DPI image
            pix = page.get_pixmap(dpi=300)
            page_img_path = os.path.join(pages_dir or "/tmp", f"page_{page_idx + 1}.png")
            pix.save(page_img_path)

            # Perform OCR
            ocr_results = self.ocr_engine.scan_image(page_img_path)

            # Create new page in searchable output PDF with exact page dimensions
            rect = page.rect
            out_page = out_doc.new_page(width=rect.width, height=rect.height)
            
            # Insert original high-res page image as background
            out_page.insert_image(rect, filename=page_img_path)

            # Scale OCR bounding boxes (calculated at 300 DPI) to PDF points
            scale_x = rect.width / pix.width
            scale_y = rect.height / pix.height

            # Insert invisible text overlay for searchability
            for item in ocr_results:
                x0, y0, x1, y1 = item["bbox"]
                pdf_rect = fitz.Rect(x0 * scale_x, y0 * scale_y, x1 * scale_x, y1 * scale_y)
                out_page.insert_text(
                    pdf_rect.tl,
                    item["text"],
                    fontsize=max(6, (y1 - y0) * scale_y * 0.75),
                    render_mode=3  # Invisible text layer
                )

            pages_metadata.append({
                "page_number": page_idx + 1,
                "width": rect.width,
                "height": rect.height,
                "image_path": page_img_path,
                "ocr_items": [
                    {
                        "id": f"p{page_idx+1}_{i}",
                        "bbox": [item["bbox"][0]*scale_x, item["bbox"][1]*scale_y, item["bbox"][2]*scale_x, item["bbox"][3]*scale_y],
                        "text": item["text"],
                        "confidence": item["confidence"]
                    }
                    for i, item in enumerate(ocr_results)
                ]
            })

        out_doc.save(output_pdf_path)
        out_doc.close()
        doc.close()

        return {
            "total_pages": len(pages_metadata),
            "output_pdf": output_pdf_path,
            "pages": pages_metadata
        }
```

- [ ] **Step 3: Run test to verify PDF building**

Run: `cd /home/chinhan/Scan_PDF/backend && pytest tests/test_pdf_builder.py -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/pdf_builder.py backend/tests/test_pdf_builder.py
git commit -m "feat: implement PDFBuilder searchable PDF generator module"
```

---

### Task 3: FastAPI Backend Server & Endpoints

**Files:**
- Create: `backend/app.py`
- Test: `backend/tests/test_app.py`

**Interfaces:**
- Produces: API endpoints `/api/scan`, `/api/task/{task_id}`, `/api/outputs/{filename}`

- [ ] **Step 1: Create API integration test**

```python
# backend/tests/test_app.py
from fastapi.testclient import TestClient
from app import app

client = TestClient(app)

def test_gpu_status():
    response = client.get("/api/status")
    assert response.status_code == 200
    data = response.json()
    assert "gpu_available" in data
```

- [ ] **Step 2: Implement FastAPI app server**

```python
# backend/app.py
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
```

- [ ] **Step 3: Run API test**

Run: `cd /home/chinhan/Scan_PDF/backend && pytest tests/test_app.py -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/app.py backend/tests/test_app.py
git commit -m "feat: implement FastAPI server with PDF scan endpoint"
```

---

### Task 4: Frontend Scaffolding & Components (React/Vite)

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.js`
- Create: `frontend/src/App.jsx`
- Create: `frontend/src/components/Header.jsx`
- Create: `frontend/src/components/DualViewer.jsx`
- Create: `frontend/src/components/LayoutEditor.jsx`
- Create: `frontend/src/api.js`

- [ ] **Step 1: Initialize Vite React frontend with Tailwind CSS**

```bash
cd /home/chinhan/Scan_PDF && npx -y create-vite@latest frontend --template react
cd /home/chinhan/Scan_PDF/frontend && npm install lucide-react axios @tailwindcss/vite tailwindcss
```

- [ ] **Step 2: Create API client helper**

```javascript
// frontend/src/api.js
import axios from 'axios';

const API_BASE = 'http://localhost:8000';

export const checkStatus = async () => {
  const res = await axios.get(`${API_BASE}/api/status`);
  return res.data;
};

export const uploadAndScanPDF = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await axios.post(`${API_BASE}/api/scan`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return res.data;
};
```

- [ ] **Step 3: Implement Header component**

```jsx
// frontend/src/components/Header.jsx
import React from 'react';
import { Cpu, Upload, FileText, Download } from 'lucide-react';

export default function Header({ onUpload, isScanning, gpuStatus, resultData }) {
  return (
    <header className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shadow-md">
      <div className="flex items-center space-x-3">
        <FileText className="w-8 h-8 text-blue-400" />
        <div>
          <h1 className="text-xl font-bold">PaddleOCR High-Precision PDF Scanner</h1>
          <p className="text-xs text-slate-400">Vietnamese Document & Financial Table Recognition</p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700 text-xs">
          <Cpu className="w-4 h-4 text-emerald-400" />
          <span>GPU: {gpuStatus?.gpu_available ? 'RTX 3050 (CUDA Active)' : 'CPU Mode'}</span>
        </div>

        <label className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2 rounded-lg flex items-center space-x-2 transition">
          <Upload className="w-4 h-4" />
          <span>{isScanning ? 'Processing...' : 'Upload PDF'}</span>
          <input type="file" accept=".pdf" onChange={onUpload} disabled={isScanning} className="hidden" />
        </label>

        {resultData && (
          <a
            href={`http://localhost:8000${resultData.searchable_url}`}
            download
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded-lg flex items-center space-x-2 transition"
          >
            <Download className="w-4 h-4" />
            <span>Download Searchable PDF</span>
          </a>
        )}
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Implement DualViewer (1-vs-1 Side-by-side synchronized viewer)**

```jsx
// frontend/src/components/DualViewer.jsx
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Link, LinkOff } from 'lucide-react';

export default function DualViewer({ resultData }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [syncScroll, setSyncScroll] = useState(true);

  if (!resultData || !resultData.data?.result) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-100 text-slate-500">
        Upload a PDF file to preview 1-vs-1 comparison
      </div>
    );
  }

  const pages = resultData.data.result.pages;
  const totalPages = pages.length;
  const activePage = pages[currentPage - 1];

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900">
      {/* Controls Bar */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-2 flex items-center justify-between text-white text-sm">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1 hover:bg-slate-700 rounded disabled:opacity-50"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span>Trang {currentPage} / {totalPages}</span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1 hover:bg-slate-700 rounded disabled:opacity-50"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={() => setSyncScroll(!syncScroll)}
            className={`flex items-center space-x-1 px-3 py-1 rounded text-xs border ${
              syncScroll ? 'bg-blue-600 border-blue-500' : 'bg-slate-700 border-slate-600'
            }`}
          >
            {syncScroll ? <Link className="w-3.5 h-3.5" /> : <LinkOff className="w-3.5 h-3.5" />}
            <span>Sync Viewer</span>
          </button>

          <div className="flex items-center space-x-1">
            <button onClick={() => setZoom(z => Math.max(50, z - 20))} className="p-1 hover:bg-slate-700 rounded">
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs w-12 text-center">{zoom}%</span>
            <button onClick={() => setZoom(z => Math.min(200, z + 20))} className="p-1 hover:bg-slate-700 rounded">
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 1-vs-1 Side-by-Side Panels */}
      <div className="flex-1 grid grid-cols-2 gap-2 p-4 overflow-hidden">
        {/* Left: Original Page Image */}
        <div className="bg-slate-950 rounded-lg p-4 overflow-auto flex flex-col items-center border border-slate-800">
          <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Trang Gốc (Original Scan)</h3>
          {activePage && (
            <img
              src={`http://localhost:8000/storage/pages/${resultData.data.result.pages[0].image_path.split('/').slice(-2).join('/')}`}
              alt={`Original Page ${currentPage}`}
              style={{ width: `${zoom}%` }}
              className="shadow-2xl rounded transition-all"
            />
          )}
        </div>

        {/* Right: Searchable PDF Preview */}
        <div className="bg-slate-950 rounded-lg p-4 overflow-auto flex flex-col items-center border border-slate-800">
          <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Searchable PDF (Lớp Text 100% Khớp)</h3>
          <iframe
            src={`http://localhost:8000${resultData.data.searchable_url}#page=${currentPage}`}
            title="Searchable PDF Preview"
            style={{ width: `${zoom}%`, height: '100%' }}
            className="rounded border border-slate-700 bg-white"
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Implement LayoutEditor component**

```jsx
// frontend/src/components/LayoutEditor.jsx
import React, { useState } from 'react';

export default function LayoutEditor({ resultData }) {
  const [hoveredBox, setHoveredBox] = useState(null);
  const [selectedBox, setSelectedBox] = useState(null);

  if (!resultData || !resultData.data?.result) return null;

  const pages = resultData.data.result.pages;
  const activePage = pages[0];

  return (
    <div className="flex-1 flex bg-slate-900 text-white p-6 overflow-hidden">
      {/* Visual Canvas Overlay */}
      <div className="w-1/2 bg-slate-950 rounded-xl p-4 overflow-auto relative border border-slate-800 flex justify-center">
        <div className="relative inline-block" style={{ width: `${activePage.width}px`, height: `${activePage.height}px` }}>
          <img
            src={`http://localhost:8000/storage/pages/${activePage.image_path.split('/').slice(-2).join('/')}`}
            alt="Page Layout"
            className="w-full h-full opacity-60"
          />

          {activePage.ocr_items.map((item) => {
            const [x0, y0, x1, y1] = item.bbox;
            const isHovered = hoveredBox === item.id;
            return (
              <div
                key={item.id}
                onMouseEnter={() => setHoveredBox(item.id)}
                onMouseLeave={() => setHoveredBox(null)}
                onClick={() => setSelectedBox(item)}
                style={{
                  position: 'absolute',
                  left: `${x0}px`,
                  top: `${y0}px`,
                  width: `${x1 - x0}px`,
                  height: `${y1 - y0}px`,
                }}
                className={`border text-[10px] leading-none px-0.5 truncate cursor-pointer transition ${
                  isHovered ? 'bg-blue-500/40 border-blue-400 text-white z-20 scale-105' : 'border-amber-400/50 bg-amber-400/10 text-amber-200'
                }`}
                title={`${item.text} (${(item.confidence * 100).toFixed(1)}%)`}
              >
                {item.text}
              </div>
            );
          })}
        </div>
      </div>

      {/* Extracted Text List / Editor */}
      <div className="w-1/2 ml-6 bg-slate-800 rounded-xl p-6 flex flex-col border border-slate-700 overflow-hidden">
        <h2 className="text-lg font-bold mb-4 flex items-center justify-between">
          <span>Chi tiết Văn bản & Bảng biểu</span>
          <span className="text-xs font-normal text-slate-400">{activePage.ocr_items.length} Khối chữ</span>
        </h2>

        <div className="flex-1 overflow-auto space-y-2 pr-2">
          {activePage.ocr_items.map((item) => (
            <div
              key={item.id}
              onMouseEnter={() => setHoveredBox(item.id)}
              onMouseLeave={() => setHoveredBox(null)}
              className={`p-3 rounded-lg border text-sm transition cursor-pointer ${
                hoveredBox === item.id ? 'bg-blue-900/50 border-blue-500' : 'bg-slate-900 border-slate-700'
              }`}
            >
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Box ID: {item.id}</span>
                <span className="text-emerald-400 font-mono">{(item.confidence * 100).toFixed(1)}%</span>
              </div>
              <p className="font-medium text-slate-100">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Build App.jsx**

```jsx
// frontend/src/App.jsx
import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import DualViewer from './components/DualViewer';
import LayoutEditor from './components/LayoutEditor';
import { checkStatus, uploadAndScanPDF } from './api';

export default function App() {
  const [gpuStatus, setGpuStatus] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [activeTab, setActiveTab] = useState('viewer');

  useEffect(() => {
    checkStatus().then(setGpuStatus).catch(console.error);
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsScanning(true);
    try {
      const data = await uploadAndScanPDF(file);
      setResultData(data);
    } catch (err) {
      alert("Lỗi khi scan PDF: " + err.message);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 font-sans">
      <Header
        onUpload={handleFileUpload}
        isScanning={isScanning}
        gpuStatus={gpuStatus}
        resultData={resultData}
      />

      <div className="flex border-b border-slate-800 bg-slate-900 px-6">
        <button
          onClick={() => setActiveTab('viewer')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
            activeTab === 'viewer' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Màn hình Đối xứng 1-vs-1
        </button>
        <button
          onClick={() => setActiveTab('layout')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
            activeTab === 'layout' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Interactive Layout & Chi tiết Bảng
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'viewer' ? (
          <DualViewer resultData={resultData} />
        ) : (
          <LayoutEditor resultData={resultData} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
cd /home/chinhan/Scan_PDF && git add frontend/
git commit -m "feat: implement React frontend with 1-vs-1 viewer and interactive layout editor"
```

---

### Task 5: End-to-End Verification with Test PDF

- [ ] **Step 1: Start FastAPI backend server on Port 8000**

Run: `cd /home/chinhan/Scan_PDF/backend && uvicorn app:app --port 8000 --reload`

- [ ] **Step 2: Start Vite frontend server on Port 3000**

Run: `cd /home/chinhan/Scan_PDF/frontend && npm run dev -- --port 3000`

- [ ] **Step 3: Run end-to-end test on sample PDF `/home/chinhan/Downloads/1. TTr_PTAP_daduyet_250725.pdf`**

Verify that:
1. File uploaded and OCR processed on RTX 3050 GPU.
2. Searchable PDF generated and downloadable.
3. DualViewer displays 1-vs-1 side-by-side comparison with page navigation.
4. Interactive Layout displays hover highlighting and text bounding boxes matching financial tables.

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "feat: complete PDF OCR web application integration and verification"
```
