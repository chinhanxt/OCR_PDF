import os
import sys
from typing import List, Dict, Any
from rapidocr import RapidOCR

class OCREngine:
    def __init__(self, use_gpu: bool = True):
        print("⚡ Initializing RapidOCR ONNX CUDA High-Precision Engine...")
        self.ocr = RapidOCR()

    def scan_image(self, image_path: str) -> List[Dict[str, Any]]:
        res = self.ocr(image_path)
        items = []
        if res and hasattr(res, 'boxes') and res.boxes is not None and len(res.boxes) > 0:
            for i in range(len(res.boxes)):
                bbox = res.boxes[i]  # [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
                text = res.txts[i] if hasattr(res, 'txts') and res.txts and i < len(res.txts) else ""
                confidence = float(res.scores[i]) if hasattr(res, 'scores') and res.scores and i < len(res.scores) else 0.9

                if not text or not text.strip():
                    continue

                x_coords = [p[0] for p in bbox]
                y_coords = [p[1] for p in bbox]
                items.append({
                    "bbox": [min(x_coords), min(y_coords), max(x_coords), max(y_coords)],
                    "text": text.strip(),
                    "confidence": confidence
                })
        return items
