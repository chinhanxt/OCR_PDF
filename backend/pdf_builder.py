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
            pix = page.get_pixmap(dpi=300)
            page_img_path = os.path.join(pages_dir or "/tmp", f"page_{page_idx + 1}.png")
            pix.save(page_img_path)

            ocr_results = self.ocr_engine.scan_image(page_img_path)

            rect = page.rect
            out_page = out_doc.new_page(width=rect.width, height=rect.height)
            out_page.insert_image(rect, filename=page_img_path)

            scale_x = rect.width / pix.width
            scale_y = rect.height / pix.height

            for item in ocr_results:
                x0, y0, x1, y1 = item["bbox"]
                pdf_rect = fitz.Rect(x0 * scale_x, y0 * scale_y, x1 * scale_x, y1 * scale_y)
                out_page.insert_text(
                    pdf_rect.tl,
                    item["text"],
                    fontsize=max(6, (y1 - y0) * scale_y * 0.75),
                    render_mode=3
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
