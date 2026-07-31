# Design Spec: High-Precision PDF OCR Web Application with PaddleOCR

**Date:** 2026-07-31  
**Target Path:** `/home/chinhan/Scan_PDF`  
**Status:** Approved by User  

---

## 1. Overview & Objective

The goal of this project is to build a web application capable of scanning non-searchable / image-based PDF documents (specifically complex Vietnamese documents with tables, financial figures, signatures, and stamps) with high accuracy.

Key requirements:
1. **Engine**: Use PaddleOCR repository at `/home/chinhan/Scan_PDF/PaddleOCR` with GPU acceleration (NVIDIA RTX 3050, CUDA 12.8).
2. **Output Format**: Generate a **Searchable PDF** by overlaying an invisible text layer matching exact OCR bounding boxes `[x0, y0, x1, y1]` over original high-resolution image pages, preserving 100% of the original visual layout, stamps, and signatures.
3. **Web Interface (Split-Screen & Interactive Layout Inspector)**:
   - **Tab 1 (1-vs-1 Side-by-Side Dual Viewer)**: Original PDF vs Scanned Searchable PDF with synchronized scrolling, page navigation, and zoom controls.
   - **Tab 2 (Interactive Layout Inspector & Field Editor)**: Reconstructs exact visual text boxes and table structures in an HTML overlay, allowing users to hover/click/edit text fields and view extracted financial table data.

---

## 2. Architecture & Components

```
/home/chinhan/Scan_PDF/
├── PaddleOCR/                  # Cloned PaddleOCR repository
├── backend/                    # Python FastAPI application (Port 8000)
│   ├── app.py                  # API endpoints (/api/scan, /api/task/{id}, /api/download)
│   ├── ocr_engine.py           # PaddleOCR GPU wrapper (PP-OCRv4 + PP-Structure layout engine)
│   ├── pdf_builder.py          # PyMuPDF / fitz engine to render images & generate Searchable PDF
│   └── requirements.txt        # Dependencies (fastapi, uvicorn, paddlepaddle-gpu, paddleocr, pymupdf, pillow)
├── frontend/                   # React + Vite + Tailwind CSS (Port 3000)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.jsx      # Header with upload button & GPU status
│   │   │   ├── DualViewer.jsx  # 1-vs-1 Side-by-Side PDF viewer (Sync scroll)
│   │   │   ├── LayoutEditor.jsx# Interactive HTML canvas field inspector
│   │   │   └── ProgressBar.jsx # Processing status per page
│   │   ├── App.jsx             # Main application layout & state management
│   │   └── api.js              # Axios/Fetch client for backend endpoints
│   ├── package.json
│   └── vite.config.js
└── storage/                    # Processing directory
    ├── uploads/                # Received PDF files
    ├── pages/                  # Extracted page PNGs (300 DPI)
    └── outputs/                # Generated Searchable PDFs and JSON metadata
```

---

## 3. Detailed Data Flow & OCR Pipeline

1. **PDF Upload**: User uploads file (e.g. `/home/chinhan/Downloads/1. TTr_PTAP_daduyet_250725.pdf`) via Frontend drag-and-drop.
2. **Page Conversion**: Backend `pdf_builder.py` converts PDF pages to 300 DPI PNG images using PyMuPDF (`fitz`).
3. **GPU OCR Processing**:
   - `ocr_engine.py` calls PaddleOCR (`use_gpu=True`, `lang='vi'`, `use_angle_cls=True`).
   - PP-Structure runs layout analysis to group table cells and paragraph bounding boxes.
   - Returns bounding boxes `[x0, y0, x1, y1]`, recognized text, confidence score, and cell matrix structure.
4. **Searchable PDF Generation**:
   - PyMuPDF opens page images, inserts invisible text layer (`render_mode=3` / font overlay) at exact bounding box coordinates.
   - Saves final searchable PDF to `storage/outputs/<filename>_searchable.pdf`.
5. **JSON Metadata Delivery**:
   - Returns structure containing page dimensions, text box elements, table rows/cols for the Interactive Layout Inspector.

---

## 4. Web UI & UX Features

- **Side-by-Side Dual Viewer (1-vs-1)**:
  - Synchronized page navigation (`Page X of Y`, prev/next, jump to page).
  - Synchronized zoom & pan.
  - Left: Original PDF canvas/image.
  - Right: Searchable PDF / Text Overlay canvas.
- **Interactive Field Inspector**:
  - Visual HTML boxes positioned precisely over page image.
  - Hovering highlights corresponding text box.
  - Click to edit text inline. Updating text regenerates Searchable PDF text layer.

---

## 5. Verification Plan

1. **Backend Verification**:
   - Verify GPU initialization (`paddle.is_compiled_with_cuda() == True`).
   - Process sample PDF `/home/chinhan/Downloads/1. TTr_PTAP_daduyet_250725.pdf` via CLI script / API test.
   - Confirm Searchable PDF text selection and Ctrl+F searchability in generated PDF.
2. **Frontend Verification**:
   - Launch Vite dev server.
   - Test PDF upload, page switching, sync scroll between 1-vs-1 viewers.
   - Test inline text editing in Interactive Layout Inspector.
