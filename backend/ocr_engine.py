import sys
import os
from typing import List, Dict, Any

paddleocr_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "PaddleOCR"))
if paddleocr_path not in sys.path:
    sys.path.append(paddleocr_path)

from paddleocr import PaddleOCR

class OCREngine:
    def __init__(self, use_gpu: bool = True):
        try:
            self.ocr = PaddleOCR(
                use_angle_cls=True,
                lang='vi',
                use_gpu=use_gpu,
                show_log=False
            )
        except Exception:
            self.ocr = PaddleOCR(
                use_angle_cls=True,
                lang='vi',
                use_gpu=False,
                show_log=False
            )

    def scan_image(self, image_path: str) -> List[Dict[str, Any]]:
        try:
            result = self.ocr.ocr(image_path, cls=True)
        except Exception:
            # Fallback to CPU if GPU execution fails at runtime
            self.ocr = PaddleOCR(
                use_angle_cls=True,
                lang='vi',
                use_gpu=False,
                show_log=False
            )
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
