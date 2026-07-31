import os
import fitz  # PyMuPDF
from typing import List, Dict, Any, Callable
from docling.datamodel.pipeline_options import PdfPipelineOptions, AcceleratorOptions, AcceleratorDevice
from docling.document_converter import DocumentConverter, PdfFormatOption

class DoclingBuilder:
    def __init__(self):
        print("⚡ Initializing Docling Engine with GPU CUDA acceleration...")
        pipeline_options = PdfPipelineOptions()
        pipeline_options.accelerator_options = AcceleratorOptions(num_threads=8, device=AcceleratorDevice.CUDA)
        pipeline_options.do_ocr = True
        pipeline_options.do_table_structure = True
        self.converter = DocumentConverter(format_options={'pdf': PdfFormatOption(pipeline_options=pipeline_options)})

    def process_pdf(
        self,
        input_pdf_path: str,
        output_pdf_path: str,
        pages_dir: str = None,
        progress_callback: Callable[[int, int], None] = None
    ) -> Dict[str, Any]:
        doc = fitz.open(input_pdf_path)
        out_doc = fitz.open()
        total_pages = len(doc)
        pages_metadata = []

        if pages_dir and not os.path.exists(pages_dir):
            os.makedirs(pages_dir, exist_ok=True)

        for page_idx in range(total_pages):
            page_no = page_idx + 1
            if progress_callback:
                progress_callback(page_no, total_pages)

            page = doc[page_idx]
            pix = page.get_pixmap(dpi=300)
            page_img_path = os.path.join(pages_dir or "/tmp", f"page_{page_no}.png")
            pix.save(page_img_path)

            rect = page.rect
            out_page = out_doc.new_page(width=rect.width, height=rect.height)
            out_page.insert_image(rect, filename=page_img_path)

            scale_x = rect.width / pix.width
            scale_y = rect.height / pix.height

            # Run Docling conversion for this specific page range (page_no, page_no)
            page_items = []
            try:
                conv_res = self.converter.convert(input_pdf_path, page_range=(page_no, page_no))
                docling_doc = conv_res.document
                if hasattr(docling_doc, 'texts') and docling_doc.texts:
                    for item in docling_doc.texts:
                        bbox_coords = [20, 20, 200, 40]
                        if hasattr(item, 'prov') and item.prov:
                            for p in item.prov:
                                if hasattr(p, 'bbox') and p.bbox:
                                    b = p.bbox
                                    bbox_coords = [b.l, b.t, b.r, b.b]
                        
                        page_items.append({
                            "text": item.text,
                            "bbox": bbox_coords,
                            "confidence": 0.95
                        })
            except Exception as e:
                print(f"Docling page {page_no} extraction note: {e}")

            for item in page_items:
                x0, y0, x1, y1 = item["bbox"]
                pdf_rect = fitz.Rect(x0 * scale_x, y0 * scale_y, x1 * scale_x, y1 * scale_y)
                if (x1 - x0) > 0 and (y1 - y0) > 0:
                    out_page.insert_text(
                        pdf_rect.tl,
                        item["text"],
                        fontsize=max(6, (y1 - y0) * scale_y * 0.75),
                        render_mode=3
                    )

            pages_metadata.append({
                "page_number": page_no,
                "width": rect.width,
                "height": rect.height,
                "image_path": page_img_path,
                "ocr_items": [
                    {
                        "id": f"docling_p{page_no}_{i}",
                        "bbox": [item["bbox"][0]*scale_x, item["bbox"][1]*scale_y, item["bbox"][2]*scale_x, item["bbox"][3]*scale_y],
                        "text": item["text"],
                        "confidence": item["confidence"]
                    }
                    for i, item in enumerate(page_items)
                ]
            })

        out_doc.save(output_pdf_path)
        out_doc.close()
        doc.close()

        if progress_callback:
            progress_callback(total_pages, total_pages)

        return {
            "engine": "docling",
            "total_pages": len(pages_metadata),
            "output_pdf": output_pdf_path,
            "pages": pages_metadata
        }
