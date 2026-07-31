import sys
import os
import glob
from typing import List, Dict, Any

# Ensure CUDA / cuDNN libraries are loaded for PaddleOCR GPU
site_pkgs = os.path.expanduser('~/.local/lib/python3.12/site-packages')
nvidia_libs = ':'.join(glob.glob(f'{site_pkgs}/nvidia/*/lib'))
if nvidia_libs:
    os.environ['LD_LIBRARY_PATH'] = nvidia_libs + ':' + os.environ.get('LD_LIBRARY_PATH', '')

paddleocr_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "PaddleOCR"))
if paddleocr_path not in sys.path:
    sys.path.append(paddleocr_path)

from paddleocr import PaddleOCR
from PIL import Image

class OCREngine:
    def __init__(self, use_gpu: bool = True):
        self.use_gpu = use_gpu
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

        # Initialize VietOCR for 100% full Vietnamese accents & sequence recognition
        self.vietocr_predictor = None
        try:
            from vietocr.tool.predictor import Predictor
            from vietocr.tool.config import Cfg
            config = Cfg.load_config_from_name('vgg_transformer')
            config['device'] = 'cpu'
            config['predictor']['beamsearch'] = False
            self.vietocr_predictor = Predictor(config)
            print("✨ VietOCR Sequence Recognizer initialized for 100% Vietnamese diacritics.")
        except Exception as e:
            print(f"VietOCR initialization skipped: {e}")

    def scan_image(self, image_path: str) -> List[Dict[str, Any]]:
        try:
            result = self.ocr.ocr(image_path, cls=True)
        except Exception:
            self.ocr = PaddleOCR(
                use_angle_cls=True,
                lang='vi',
                use_gpu=False,
                show_log=False
            )
            result = self.ocr.ocr(image_path, cls=True)

        items = []
        if not result or not result[0]:
            return items

        img = None
        if self.vietocr_predictor:
            try:
                img = Image.open(image_path).convert('RGB')
            except Exception:
                img = None

        crops = []
        item_indices = []

        for idx, line in enumerate(result[0]):
            bbox = line[0]  # [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
            paddle_text, confidence = line[1]
            x_coords = [p[0] for p in bbox]
            y_coords = [p[1] for p in bbox]
            x0, y0, x1, y1 = min(x_coords), min(y_coords), max(x_coords), max(y_coords)

            item = {
                "bbox": [x0, y0, x1, y1],
                "text": paddle_text,
                "confidence": float(confidence)
            }
            items.append(item)

            if self.vietocr_predictor and img and (x1 - x0) > 8 and (y1 - y0) > 8:
                pad = 2
                crop_box = (
                    max(0, int(x0 - pad)),
                    max(0, int(y0 - pad)),
                    min(img.width, int(x1 + pad)),
                    min(img.height, int(y1 + pad))
                )
                try:
                    crop_img = img.crop(crop_box)
                    crops.append(crop_img)
                    item_indices.append(idx)
                except Exception:
                    pass

        # High-speed VietOCR batch inference
        if self.vietocr_predictor and crops:
            try:
                viet_texts = self.vietocr_predictor.predict_batch(crops)
                for item_idx, viet_text in zip(item_indices, viet_texts):
                    if viet_text and len(viet_text.strip()) > 0:
                        items[item_idx]["text"] = viet_text.strip()
            except Exception as e:
                print(f"VietOCR batch predict fallback: {e}")

        return items
