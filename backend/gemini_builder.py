import os
import json
import fitz  # PyMuPDF
import unicodedata
import concurrent.futures
from PIL import Image
from typing import List, Dict, Any, Callable
import google.generativeai as genai
from docx_builder import DOCXBuilder
from ocr_engine import OCREngine

class GeminiBuilder:
    def __init__(self, api_key: str = None):
        self.docx_builder = DOCXBuilder()
        self.api_key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        self.fallback_ocr = None

    def _get_fallback_ocr(self):
        if self.fallback_ocr is None:
            self.fallback_ocr = OCREngine(use_gpu=True)
        return self.fallback_ocr

    def _get_configured_model(self, api_key: str = None, model_name: str = "gemini-2.5-flash"):
        effective_key = api_key or self.api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not effective_key or not effective_key.strip():
            raise ValueError("Chưa có Gemini API Key. Vui lòng bấm '🔑 API Key' trên giao diện web để nhập Gemini API Key!")
        
        clean_key = effective_key.strip()
        genai.configure(api_key=clean_key)
        
        # Explicitly validate API key validity with Google API before proceeding
        try:
            active_models = [m.name for m in genai.list_models() if 'generateContent' in getattr(m, 'supported_generation_methods', [])]
        except Exception as key_err:
            raise ValueError(f"Gemini API Key không hợp lệ hoặc bị lỗi từ chối: {str(key_err)}. Vui lòng bấm '🔑 API Key' để kiểm tra và cập nhật Key mới!")

        candidates = [model_name]
        if "models/" not in model_name:
            candidates.append(f"models/{model_name}")
        candidates.extend(active_models)
        candidates.extend(["gemini-2.5-flash", "models/gemini-2.5-flash", "gemini-2.0-flash", "models/gemini-2.0-flash", "gemini-1.5-flash"])

        for cand in candidates:
            try:
                model = genai.GenerativeModel(cand)
                return model, cand.replace("models/", "")
            except Exception:
                continue

        return genai.GenerativeModel("gemini-2.5-flash"), "gemini-2.5-flash"

    def _process_single_page_gemini(self, page_idx: int, input_pdf_path: str, pages_dir: str, model, json_prompt: str) -> Dict[str, Any]:
        page_no = page_idx + 1
        doc = fitz.open(input_pdf_path)
        page = doc[page_idx]
        rect = page.rect
        # ⚡ 160 DPI rendering for ultra-fast rendering while maintaining high vision OCR quality
        pix = page.get_pixmap(dpi=160)
        page_img_path = os.path.join(pages_dir or "/tmp", f"page_{page_no}.png")
        pix.save(page_img_path)
        doc.close()

        pil_img = Image.open(page_img_path)
        page_items = []
        gemini_success = False

        # 1. Attempt Multimodal JSON Extraction via Gemini
        try:
            response = model.generate_content(
                [json_prompt, pil_img],
                generation_config={"response_mime_type": "application/json"}
            )
            resp_text = response.text.strip() if response and response.text else ""
            
            # Cleanup markdown code blocks if returned
            if resp_text.startswith("```"):
                lines = resp_text.splitlines()
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].strip() == "```":
                    lines = lines[:-1]
                resp_text = "\n".join(lines).strip()

            parsed = json.loads(resp_text)
            raw_items = parsed.get("items", []) if isinstance(parsed, dict) else (parsed if isinstance(parsed, list) else [])

            for idx, item in enumerate(raw_items):
                if not isinstance(item, dict):
                    continue
                text = item.get("text", "").strip()
                if not text:
                    continue
                
                bbox = item.get("bbox", [50, idx * 30, 950, (idx + 1) * 30])
                x0 = float((bbox[0] / 1000.0) * rect.width)
                y0 = float((bbox[1] / 1000.0) * rect.height)
                x1 = float((bbox[2] / 1000.0) * rect.width)
                y1 = float((bbox[3] / 1000.0) * rect.height)

                page_items.append({
                    "id": f"gemini_p{page_no}_{idx}",
                    "type": item.get("type", "text"),
                    "row": item.get("row"),
                    "col": item.get("col"),
                    "bbox": [x0, y0, x1, y1],
                    "text": unicodedata.normalize('NFC', text),
                    "confidence": 0.99
                })

            if page_items:
                gemini_success = True
        except Exception as e:
            print(f"Gemini JSON mode page {page_no} notice: {e}")

        # 2. Fallback to Plain-text line extraction via Gemini if JSON mode returned empty
        if not gemini_success:
            try:
                text_prompt = "Trích xuất toàn bộ văn bản Tiếng Việt trong ảnh này theo từng dòng chuẩn xác. Không thêm lời dẫn."
                text_resp = model.generate_content([text_prompt, pil_img])
                raw_text = text_resp.text.strip() if text_resp and text_resp.text else ""
                
                lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
                if lines:
                    line_h = rect.height / max(1, len(lines) + 2)
                    for idx, line_str in enumerate(lines):
                        y0 = (idx + 1) * line_h
                        y1 = y0 + line_h * 0.8
                        page_items.append({
                            "id": f"gemini_text_p{page_no}_{idx}",
                            "type": "text",
                            "bbox": [50.0, float(y0), float(rect.width - 50.0), float(y1)],
                            "text": unicodedata.normalize('NFC', line_str),
                            "confidence": 0.98
                        })
                    gemini_success = True
            except Exception as e2:
                print(f"Gemini Plaintext mode page {page_no} notice: {e2}")

        # 3. Final Fallback to RapidOCR / PyMuPDF if Gemini API returned no items
        if not page_items:
            print(f"⚡ Falling back to RapidOCR for page {page_no}...")
            try:
                ocr = self._get_fallback_ocr()
                ocr_results = ocr.scan_image(page_img_path)
                scale_x = rect.width / pix.width
                scale_y = rect.height / pix.height
                for idx, item in enumerate(ocr_results):
                    x0, y0, x1, y1 = item["bbox"]
                    page_items.append({
                        "id": f"ocr_fallback_p{page_no}_{idx}",
                        "type": "text",
                        "bbox": [float(x0 * scale_x), float(y0 * scale_y), float(x1 * scale_x), float(y1 * scale_y)],
                        "text": item["text"],
                        "confidence": item.get("confidence", 0.90)
                    })
            except Exception as e3:
                print(f"OCR Fallback page {page_no} notice: {e3}")

        return {
            "page_idx": page_idx,
            "page_number": page_no,
            "width": float(rect.width),
            "height": float(rect.height),
            "image_path": page_img_path,
            "page_items": page_items
        }

    def process_pdf(
        self,
        input_pdf_path: str,
        output_pdf_path: str,
        pages_dir: str = None,
        progress_callback: Callable[[int, int], None] = None,
        api_key: str = None,
        model_name: str = "gemini-2.5-flash"
    ) -> Dict[str, Any]:
        doc = fitz.open(input_pdf_path)
        out_doc = fitz.open()
        total_pages = len(doc)
        doc.close()

        model, active_model_name = self._get_configured_model(api_key, model_name)
        print(f"🤖 Processing PDF with Gemini AI Model: {active_model_name} (Parallel Multi-threading Enabled)")

        if pages_dir and not os.path.exists(pages_dir):
            os.makedirs(pages_dir, exist_ok=True)

        json_prompt = """
You are an expert Document OCR System. Read this document page image and extract ALL text, headings, and table data accurately with full Vietnamese diacritics.

Return ONLY a JSON object strictly matching this schema without any markdown formatting or preambles:
{
  "items": [
    {
      "text": "Exact text line or table cell value",
      "type": "text" or "heading" or "table_cell",
      "bbox": [x0, y0, x1, y1],
      "row": optional_int,
      "col": optional_int
    }
  ]
}

Note: bbox coordinates [x0, y0, x1, y1] should be relative to 1000x1000 page dimension (0 to 1000).
"""

        # ⚡ PARALLEL CONCURRENT GEMINI API CALLS (Mode 3 Speedup: 10x faster)
        max_workers = min(8, total_pages) if total_pages > 1 else 1
        page_results = [None] * total_pages
        completed = 0

        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_idx = {
                executor.submit(self._process_single_page_gemini, p_idx, input_pdf_path, pages_dir, model, json_prompt): p_idx
                for p_idx in range(total_pages)
            }
            for future in concurrent.futures.as_completed(future_to_idx):
                p_idx = future_to_idx[future]
                res = future.result()
                page_results[p_idx] = res
                completed += 1
                if progress_callback:
                    progress_callback(completed, total_pages)

        pages_metadata = []
        for p_res in page_results:
            page_no = p_res["page_number"]
            w = p_res["width"]
            h = p_res["height"]
            page_img_path = p_res["image_path"]
            page_items = p_res["page_items"]

            out_page = out_doc.new_page(width=w, height=h)
            out_page.insert_image(fitz.Rect(0, 0, w, h), filename=page_img_path)

            for item in page_items:
                x0, y0, x1, y1 = item["bbox"]
                pdf_rect = fitz.Rect(x0, y0, x1, y1)
                if (x1 - x0) > 0 and (y1 - y0) > 0:
                    out_page.insert_text(
                        pdf_rect.tl,
                        item["text"],
                        fontsize=max(6, (y1 - y0) * 0.75),
                        render_mode=3
                    )

            pages_metadata.append({
                "page_number": page_no,
                "width": w,
                "height": h,
                "image_path": page_img_path,
                "ocr_items": page_items
            })

        out_doc.save(output_pdf_path)
        out_doc.close()

        # Build DOCX output file
        output_docx_path = output_pdf_path.replace("_searchable.pdf", "_gemini_result.docx").replace(".pdf", ".docx")
        self.docx_builder.build_docx_for_gemini(pages_metadata, output_docx_path, model_name=active_model_name)

        if progress_callback:
            progress_callback(total_pages, total_pages)

        return {
            "engine": "gemini",
            "model_name": active_model_name,
            "total_pages": len(pages_metadata),
            "output_pdf": output_pdf_path,
            "output_docx": output_docx_path,
            "pages": pages_metadata
        }
