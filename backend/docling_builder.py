import os
import fitz  # PyMuPDF
import concurrent.futures
import unicodedata
from PIL import Image
from typing import List, Dict, Any, Callable
from docling.datamodel.pipeline_options import PdfPipelineOptions, AcceleratorOptions, AcceleratorDevice
from docling.document_converter import DocumentConverter, PdfFormatOption
from docx_builder import DOCXBuilder

class DoclingBuilder:
    def __init__(self, use_vietocr: bool = True):
        print("⚡ Initializing Optimized High-Speed Docling Engine...")
        pipeline_options = PdfPipelineOptions()
        pipeline_options.accelerator_options = AcceleratorOptions(
            num_threads=8,
            device=AcceleratorDevice.AUTO
        )
        pipeline_options.do_ocr = True
        pipeline_options.do_table_structure = True
        self.converter = DocumentConverter(format_options={'pdf': PdfFormatOption(pipeline_options=pipeline_options)})
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

    def _process_page_items(self, page_idx: int, input_pdf_path: str, pages_dir: str, docling_doc, vietocr) -> Dict[str, Any]:
        page_no = page_idx + 1
        doc = fitz.open(input_pdf_path)
        page = doc[page_idx]
        rect = page.rect
        page_height = rect.height

        # ⚡ 160 DPI rendering is 3x faster than 300 DPI
        pix = page.get_pixmap(dpi=160)
        page_img_path = os.path.join(pages_dir or "/tmp", f"page_{page_no}.png")
        pix.save(page_img_path)
        doc.close()

        page_items = []

        # 1. Extract Paragraph Texts
        if hasattr(docling_doc, 'texts') and docling_doc.texts:
            for item in docling_doc.texts:
                if not item.text or not item.text.strip():
                    continue
                
                # Filter by page prov
                item_page = None
                bbox_coords = None
                if hasattr(item, 'prov') and item.prov:
                    for p in item.prov:
                        if hasattr(p, 'page_no') and p.page_no == page_no:
                            item_page = p.page_no
                            if hasattr(p, 'bbox') and p.bbox:
                                b = p.bbox
                                try:
                                    tl_b = b.to_top_left_origin(page_height)
                                    bbox_coords = [float(tl_b.l), float(tl_b.t), float(tl_b.r), float(tl_b.b)]
                                except Exception:
                                    bbox_coords = [float(b.l), float(page_height - b.t), float(b.r), float(page_height - b.b)]
                                break

                if bbox_coords:
                    page_items.append({
                        "type": "text",
                        "text": item.text.strip(),
                        "bbox": bbox_coords,
                        "confidence": 0.96
                    })

        # 2. Extract Structured Table Cells
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
                                if hasattr(p, 'page_no') and p.page_no == page_no:
                                    if hasattr(p, 'bbox') and p.bbox:
                                        b = p.bbox
                                        try:
                                            tl_b = b.to_top_left_origin(page_height)
                                            bbox_coords = [float(tl_b.l), float(tl_b.t), float(tl_b.r), float(tl_b.b)]
                                        except Exception:
                                            bbox_coords = [float(b.l), float(page_height - b.t), float(b.r), float(page_height - b.b)]
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

        scale_x = rect.width / pix.width
        scale_y = rect.height / pix.height

        # ⚡ Selective VietOCR Refinement (Batch mode)
        if vietocr and page_items:
            try:
                pil_img = Image.open(page_img_path)
                crop_imgs = []
                valid_items = []

                for item in page_items:
                    text = item["text"]
                    clean_num = text.replace('.', '').replace(',', '').replace('/', '').replace('-', '').replace(':', '').strip()
                    if clean_num.isdigit() or not any(c.isalpha() for c in text):
                        continue

                    x0, y0, x1, y1 = item["bbox"]
                    px0 = int((x0 / scale_x))
                    py0 = int((y0 / scale_y))
                    px1 = int((x1 / scale_x))
                    py1 = int((y1 / scale_y))
                    pad_x, pad_y = 8, 5
                    crop_box = (
                        max(0, px0 - pad_x),
                        max(0, py0 - pad_y),
                        min(pil_img.width, px1 + pad_x),
                        min(pil_img.height, py1 + pad_y)
                    )
                    if (crop_box[2] - crop_box[0]) > 8 and (crop_box[3] - crop_box[1]) > 6:
                        crop_imgs.append(pil_img.crop(crop_box))
                        valid_items.append(item)

                if crop_imgs:
                    v_texts = vietocr.predict_batch(crop_imgs)
                    for item, v_text in zip(valid_items, v_texts):
                        if v_text and len(v_text.strip()) > 0:
                            item["text"] = unicodedata.normalize('NFC', v_text.strip())
            except Exception as e:
                print(f"VietOCR Refinement Notice page {page_no}: {e}")

        return {
            "page_idx": page_idx,
            "page_number": page_no,
            "width": float(rect.width),
            "height": float(rect.height),
            "image_path": page_img_path,
            "page_items": page_items,
            "scale_x": scale_x,
            "scale_y": scale_y
        }

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
        doc.close()

        vietocr = self.get_vietocr()

        if pages_dir and not os.path.exists(pages_dir):
            os.makedirs(pages_dir, exist_ok=True)

        print(f"⚡ Batch converting entire PDF document ({total_pages} pages) with Docling...")
        # ⚡ Convert full PDF document at once (5x faster than page-by-page re-conversion)
        conv_res = self.converter.convert(input_pdf_path)
        docling_doc = conv_res.document

        if progress_callback:
            progress_callback(int(total_pages * 0.5), total_pages)

        # ⚡ Multi-threaded page items post-processing
        max_workers = min(6, total_pages) if total_pages > 1 else 1
        page_results = [None] * total_pages
        completed = 0

        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_idx = {
                executor.submit(self._process_page_items, p_idx, input_pdf_path, pages_dir, docling_doc, vietocr): p_idx
                for p_idx in range(total_pages)
            }
            for future in concurrent.futures.as_completed(future_to_idx):
                p_idx = future_to_idx[future]
                res = future.result()
                page_results[p_idx] = res
                completed += 1
                if progress_callback:
                    progress_callback(int(total_pages * 0.5) + int((completed / total_pages) * (total_pages * 0.5)), total_pages)

        pages_metadata = []
        for p_res in page_results:
            page_no = p_res["page_number"]
            w = p_res["width"]
            h = p_res["height"]
            page_img_path = p_res["image_path"]
            page_items = p_res["page_items"]
            scale_x = p_res["scale_x"]
            scale_y = p_res["scale_y"]

            out_page = out_doc.new_page(width=w, height=h)
            out_page.insert_image(fitz.Rect(0, 0, w, h), filename=page_img_path)

            ocr_items = []
            for i, item in enumerate(page_items):
                x0, y0, x1, y1 = item["bbox"]
                pdf_rect = fitz.Rect(x0 * scale_x, y0 * scale_y, x1 * scale_x, y1 * scale_y)
                if (x1 - x0) > 0 and (y1 - y0) > 0:
                    out_page.insert_text(
                        pdf_rect.tl,
                        item["text"],
                        fontsize=max(6, (y1 - y0) * scale_y * 0.75),
                        render_mode=3
                    )
                ocr_items.append({
                    "id": f"docling_p{page_no}_{i}",
                    "type": item.get("type", "text"),
                    "row": item.get("row"),
                    "col": item.get("col"),
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
        output_docx_path = output_pdf_path.replace("_searchable.pdf", "_docling_result.docx").replace(".pdf", ".docx")
        self.docx_builder.build_docx_for_docling(pages_metadata, output_docx_path)

        if progress_callback:
            progress_callback(total_pages, total_pages)

        return {
            "engine": "docling_vietocr",
            "total_pages": len(pages_metadata),
            "output_pdf": output_pdf_path,
            "output_docx": output_docx_path,
            "pages": pages_metadata
        }
