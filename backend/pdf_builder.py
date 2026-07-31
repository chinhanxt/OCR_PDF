import fitz  # PyMuPDF
import os
from PIL import Image
from typing import List, Dict, Any, Callable
from ocr_engine import OCREngine
from docx_builder import DOCXBuilder

class PDFBuilder:
    def __init__(self, use_vietocr: bool = True):
        self.ocr_engine = OCREngine(use_gpu=True)
        self.docx_builder = DOCXBuilder()
        self.use_vietocr = use_vietocr
        self.vietocr_engine = None

    def get_vietocr(self):
        if self.vietocr_engine is None and self.use_vietocr:
            try:
                from vietocr_engine import VietOCREngine
                self.vietocr_engine = VietOCREngine()
            except Exception as e:
                print(f"Warning: VietOCR loading failed: {e}")
        return self.vietocr_engine

    def process_pdf(
        self,
        input_pdf_path: str,
        output_pdf_path: str,
        pages_dir: str = None,
        progress_callback: Callable[[int, int], None] = None
    ) -> Dict[str, Any]:
        doc = fitz.open(input_pdf_path)
        out_doc = fitz.open()
        pages_metadata = []
        total_pages = len(doc)
        vietocr = self.get_vietocr()

        if pages_dir and not os.path.exists(pages_dir):
            os.makedirs(pages_dir, exist_ok=True)

        for page_idx in range(total_pages):
            if progress_callback:
                progress_callback(page_idx + 1, total_pages)

            page = doc[page_idx]
            pix = page.get_pixmap(dpi=300)
            page_img_path = os.path.join(pages_dir or "/tmp", f"page_{page_idx + 1}.png")
            pix.save(page_img_path)

            ocr_results = self.ocr_engine.scan_image(page_img_path)

            # Refine text items using VietOCR Transformer
            if vietocr and ocr_results:
                try:
                    pil_img = Image.open(page_img_path)
                    crop_imgs = []
                    valid_items = []

                    for item in ocr_results:
                        x0, y0, x1, y1 = item["bbox"]
                        pad = 4
                        crop_box = (
                            max(0, int(x0 - pad)),
                            max(0, int(y0 - pad)),
                            min(pil_img.width, int(x1 + pad)),
                            min(pil_img.height, int(y1 + pad))
                        )
                        if (crop_box[2] - crop_box[0]) > 10 and (crop_box[3] - crop_box[1]) > 8:
                            crop_imgs.append(pil_img.crop(crop_box))
                            valid_items.append(item)

                    if crop_imgs:
                        v_texts = vietocr.predict_batch(crop_imgs)
                        for item, v_text in zip(valid_items, v_texts):
                            if v_text:
                                item["text"] = v_text
                except Exception as e:
                    print(f"VietOCR Refinement Error: {e}")

            rect = page.rect
            out_page = out_doc.new_page(width=rect.width, height=rect.height)
            out_page.insert_image(rect, filename=page_img_path)

            scale_x = rect.width / pix.width
            scale_y = rect.height / pix.height

            for item in ocr_results:
                x0, y0, x1, y1 = item["bbox"]
                pdf_rect = fitz.Rect(float(x0 * scale_x), float(y0 * scale_y), float(x1 * scale_x), float(y1 * scale_y))
                out_page.insert_text(
                    pdf_rect.tl,
                    item["text"],
                    fontsize=float(max(6, (y1 - y0) * scale_y * 0.75)),
                    render_mode=3
                )

            pages_metadata.append({
                "page_number": page_idx + 1,
                "width": float(rect.width),
                "height": float(rect.height),
                "image_path": page_img_path,
                "ocr_items": [
                    {
                        "id": f"p{page_idx+1}_{i}",
                        "bbox": [float(item["bbox"][0]*scale_x), float(item["bbox"][1]*scale_y), float(item["bbox"][2]*scale_x), float(item["bbox"][3]*scale_y)],
                        "text": item["text"],
                        "confidence": float(item["confidence"])
                    }
                    for i, item in enumerate(ocr_results)
                ]
            })

        out_doc.save(output_pdf_path)
        out_doc.close()
        doc.close()

        # Build Word .docx file
        output_docx_path = output_pdf_path.replace("_searchable.pdf", "_result.docx").replace(".pdf", ".docx")
        self.docx_builder.build_docx_for_paddle(pages_metadata, output_docx_path)

        if progress_callback:
            progress_callback(total_pages, total_pages)

        return {
            "engine": "rapidocr_vietocr",
            "total_pages": len(pages_metadata),
            "output_pdf": output_pdf_path,
            "output_docx": output_docx_path,
            "pages": pages_metadata
        }
