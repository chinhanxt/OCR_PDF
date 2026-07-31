import os
import fitz  # PyMuPDF
from typing import List, Dict, Any, Callable
from docling.datamodel.pipeline_options import PdfPipelineOptions, AcceleratorOptions, AcceleratorDevice
from docling.document_converter import DocumentConverter, PdfFormatOption
from docx_builder import DOCXBuilder

class DoclingBuilder:
    def __init__(self):
        print("⚡ Initializing Docling Engine with Precision Bounding Box Origin...")
        pipeline_options = PdfPipelineOptions()
        pipeline_options.accelerator_options = AcceleratorOptions(
            num_threads=4,
            device=AcceleratorDevice.AUTO
        )
        pipeline_options.do_ocr = True
        pipeline_options.do_table_structure = True
        self.converter = DocumentConverter(format_options={'pdf': PdfFormatOption(pipeline_options=pipeline_options)})
        self.docx_builder = DOCXBuilder()

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
            page = doc[page_idx]
            page_rect = page.rect
            page_height = page_rect.height

            # ⚡ Live progress update for web modal
            if progress_callback:
                progress_callback(page_no, total_pages)

            print(f"⚡ Docling processing page {page_no} / {total_pages}...")
            
            # Convert individual page
            conv_res = self.converter.convert(input_pdf_path, page_range=(page_no, page_no))
            docling_doc = conv_res.document

            page_items = []

            # 1. Extract Paragraph Texts with Top-Left Origin Conversion
            if hasattr(docling_doc, 'texts') and docling_doc.texts:
                for item in docling_doc.texts:
                    if not item.text or not item.text.strip():
                        continue
                    
                    bbox_coords = None
                    if hasattr(item, 'prov') and item.prov:
                        for p in item.prov:
                            if hasattr(p, 'bbox') and p.bbox:
                                b = p.bbox
                                try:
                                    tl_b = b.to_top_left_origin(page_height)
                                    bbox_coords = [tl_b.l, tl_b.t, tl_b.r, tl_b.b]
                                except Exception:
                                    bbox_coords = [b.l, page_height - b.t, b.r, page_height - b.b]
                                break

                    if bbox_coords:
                        page_items.append({
                            "type": "text",
                            "text": item.text.strip(),
                            "bbox": bbox_coords,
                            "confidence": 0.96
                        })

            # 2. Extract Structured Table Cells (TableFormer) with Top-Left Origin Conversion
            if hasattr(docling_doc, 'tables') and docling_doc.tables:
                for t_idx, table in enumerate(docling_doc.tables):
                    if hasattr(table, 'data') and hasattr(table.data, 'table_cells'):
                        for cell in table.data.table_cells:
                            cell_text = cell.text.strip() if cell.text else ""
                            if not cell_text:
                                continue
                            
                            bbox_coords = None
                            if hasattr(cell, 'prov') and cell.prov:
                                for p in cell.prov:
                                    if hasattr(p, 'bbox') and p.bbox:
                                        b = p.bbox
                                        try:
                                            tl_b = b.to_top_left_origin(page_height)
                                            bbox_coords = [tl_b.l, tl_b.t, tl_b.r, tl_b.b]
                                        except Exception:
                                            bbox_coords = [b.l, page_height - b.t, b.r, page_height - b.b]
                                        break

                            if bbox_coords:
                                page_items.append({
                                    "type": "table_cell",
                                    "row": cell.start_row_offset_idx,
                                    "col": cell.start_col_offset_idx,
                                    "text": cell_text,
                                    "bbox": bbox_coords,
                                    "confidence": 0.98
                                })

            # Render page image and searchable PDF layer
            pix = page.get_pixmap(dpi=300)
            page_img_path = os.path.join(pages_dir or "/tmp", f"page_{page_no}.png")
            pix.save(page_img_path)

            rect = page.rect
            out_page = out_doc.new_page(width=rect.width, height=rect.height)
            out_page.insert_image(rect, filename=page_img_path)

            scale_x = rect.width / pix.width
            scale_y = rect.height / pix.height

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
                        "type": item.get("type", "text"),
                        "row": item.get("row"),
                        "col": item.get("col"),
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

        # Build Word .docx file
        output_docx_path = output_pdf_path.replace("_searchable.pdf", "_docling_result.docx").replace(".pdf", ".docx")
        self.docx_builder.build_docx_for_docling(pages_metadata, output_docx_path)

        if progress_callback:
            progress_callback(total_pages, total_pages)

        return {
            "engine": "docling",
            "total_pages": len(pages_metadata),
            "output_pdf": output_pdf_path,
            "output_docx": output_docx_path,
            "pages": pages_metadata
        }
