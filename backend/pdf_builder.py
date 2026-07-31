import fitz  # PyMuPDF
import os
import torch
import unicodedata
import concurrent.futures
from PIL import Image
from typing import List, Dict, Any, Callable
from ocr_engine import OCREngine
from docx_builder import DOCXBuilder

# Optimize PyTorch CPU thread contention
try:
    torch.set_num_threads(1)
except Exception:
    pass

VIET_ACCENTS = set('àáảãạăằẳẵắặâầẩẫấậèéẻẽẹêềểễếệìíỉĩịòóỏõọôồổỗốộơờởỡớợùúủũụưừửữứựỳýỷỹỵđĐ')

def needs_vietocr_refinement(item: dict) -> bool:
    text = item.get("text", "")
    conf = item.get("confidence", 1.0)
    if not any(c.isalpha() for c in text):
        return False
    clean_text = text.strip()
    if len(clean_text) <= 3 and clean_text.isupper():
        return False
    # Refine only low-confidence items or unaccented vietnamese words
    if conf >= 0.92:
        return False
    words = clean_text.split()
    unaccented_words = [w for w in words if any(c.isalpha() for c in w) and not any(c in VIET_ACCENTS for c in w)]
    has_accents = any(c in VIET_ACCENTS for c in clean_text)
    if has_accents and len(unaccented_words) == 0:
        return False
    return True

class PDFBuilder:
    def __init__(self, use_vietocr: bool = True):
        self.ocr_engine = OCREngine(use_gpu=True)
        self.docx_builder = DOCXBuilder()
        self.use_vietocr = use_vietocr
        self.vietocr_engine = None

    def get_vietocr(self):
        if self.vietocr_engine is None:
            try:
                from vietocr_engine import VietOCREngine
                self.vietocr_engine = VietOCREngine()
            except Exception as e:
                print(f"Warning: VietOCR loading failed: {e}")
        return self.vietocr_engine

    def _process_single_page_ocr(self, page_idx: int, input_pdf_path: str, pages_dir: str) -> Dict[str, Any]:
        doc = fitz.open(input_pdf_path)
        page = doc[page_idx]
        rect = page.rect
        # ⚡ 160 DPI rendering for 2x faster execution while preserving OCR text quality
        pix = page.get_pixmap(dpi=160)
        page_img_path = os.path.join(pages_dir or "/tmp", f"page_{page_idx + 1}.png")
        pix.save(page_img_path)
        doc.close()

        ocr_results = self.ocr_engine.scan_image(page_img_path)
        scale_x = rect.width / pix.width
        scale_y = rect.height / pix.height

        return {
            "page_idx": page_idx,
            "page_number": page_idx + 1,
            "width": float(rect.width),
            "height": float(rect.height),
            "image_path": page_img_path,
            "ocr_results": ocr_results,
            "scale_x": scale_x,
            "scale_y": scale_y
        }

    def process_pdf(
        self,
        input_pdf_path: str,
        output_pdf_path: str,
        pages_dir: str = None,
        progress_callback: Callable[[int, int], None] = None,
        use_vietocr: bool = True
    ) -> Dict[str, Any]:
        doc = fitz.open(input_pdf_path)
        out_doc = fitz.open()
        total_pages = len(doc)
        doc.close()

        self.use_vietocr = use_vietocr
        vietocr = self.get_vietocr() if self.use_vietocr else None

        if pages_dir and not os.path.exists(pages_dir):
            os.makedirs(pages_dir, exist_ok=True)

        print(f"⚡ Phase 1: Parallel RapidOCR scanning ({total_pages} pages)...")
        # ⚡ Phase 1: Parallel Multi-threaded RapidOCR Scanning
        max_workers = min(6, total_pages) if total_pages > 1 else 1
        page_data = [None] * total_pages
        completed = 0

        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_idx = {
                executor.submit(self._process_single_page_ocr, p_idx, input_pdf_path, pages_dir): p_idx
                for p_idx in range(total_pages)
            }
            for future in concurrent.futures.as_completed(future_to_idx):
                p_idx = future_to_idx[future]
                res = future.result()
                page_data[p_idx] = res
                completed += 1
                if progress_callback:
                    progress_callback(int(completed * 0.7), total_pages)

        # ⚡ Phase 2: Global Batch VietOCR Refinement (Only for low-confidence words)
        if vietocr:
            print("⚡ Phase 2: Selective VietOCR Global Batch Refinement...")
            all_crops = []
            crop_map = []  # (page_idx, item_idx)

            for p_idx, p_res in enumerate(page_data):
                img_p = p_res["image_path"]
                ocr_res = p_res["ocr_results"]
                if not ocr_res or not os.path.exists(img_p):
                    continue

                try:
                    pil_img = Image.open(img_p)
                    for item_idx, item in enumerate(ocr_res):
                        if not needs_vietocr_refinement(item):
                            continue

                        x0, y0, x1, y1 = item["bbox"]
                        pad_x, pad_y = 8, 5
                        crop_box = (
                            max(0, int(x0 - pad_x)),
                            max(0, int(y0 - pad_y)),
                            min(pil_img.width, int(x1 + pad_x)),
                            min(pil_img.height, int(y1 + pad_y))
                        )
                        if (crop_box[2] - crop_box[0]) > 8 and (crop_box[3] - crop_box[1]) > 6:
                            all_crops.append(pil_img.crop(crop_box))
                            crop_map.append((p_idx, item_idx))
                except Exception as e:
                    print(f"Crop collection notice page {p_idx+1}: {e}")

                try:
                    print(f"Running VietOCR batch prediction on {len(all_crops)} targeted low-confidence crops...")
                    v_results = vietocr.predict_batch(all_crops)
                    for (p_idx, item_idx), v_text in zip(crop_map, v_results):
                        if v_text and len(v_text.strip()) > 0:
                            page_data[p_idx]["ocr_results"][item_idx]["text"] = unicodedata.normalize('NFC', v_text.strip())
                except Exception as ve:
                    print(f"VietOCR Global Batch error: {ve}")

        pages_metadata = []
        for p_res in page_data:
            page_no = p_res["page_number"]
            w = p_res["width"]
            h = p_res["height"]
            page_img_path = p_res["image_path"]
            ocr_results = p_res["ocr_results"]
            scale_x = p_res["scale_x"]
            scale_y = p_res["scale_y"]

            out_page = out_doc.new_page(width=w, height=h)
            out_page.insert_image(fitz.Rect(0, 0, w, h), filename=page_img_path)

            ocr_items = []
            for i, item in enumerate(ocr_results):
                x0, y0, x1, y1 = item["bbox"]
                pdf_rect = fitz.Rect(float(x0 * scale_x), float(y0 * scale_y), float(x1 * scale_x), float(y1 * scale_y))
                out_page.insert_text(
                    pdf_rect.tl,
                    item["text"],
                    fontsize=float(max(6, (y1 - y0) * scale_y * 0.75)),
                    render_mode=3
                )
                ocr_items.append({
                    "id": f"p{page_no}_{i}",
                    "bbox": [float(x0 * scale_x), float(y0 * scale_y), float(x1 * scale_x), float(y1 * scale_y)],
                    "text": item["text"],
                    "confidence": float(item["confidence"])
                })

            pages_metadata.append({
                "page_number": page_no,
                "width": w,
                "height": h,
                "image_path": page_img_path,
                "ocr_items": ocr_items
            })

        out_doc.save(output_pdf_path)
        out_doc.close()

        # Build Word .docx file
        output_docx_path = output_pdf_path.replace("_searchable.pdf", "_result.docx").replace(".pdf", ".docx")
        self.docx_builder.build_docx_for_paddle(pages_metadata, output_docx_path)

        if progress_callback:
            progress_callback(total_pages, total_pages)

        return {
            "engine": "rapidocr_vietocr" if self.use_vietocr else "rapidocr_fast",
            "total_pages": len(pages_metadata),
            "output_pdf": output_pdf_path,
            "output_docx": output_docx_path,
            "pages": pages_metadata
        }
