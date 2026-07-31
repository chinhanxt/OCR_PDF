import os
import torch
from PIL import Image
from typing import List
from vietocr.tool.predictor import Predictor
from vietocr.tool.config import Cfg

class VietOCREngine:
    def __init__(self, model_name: str = 'vgg_transformer', device: str = None):
        torch.set_num_threads(4)
        if device is None:
            device = 'cuda:0' if torch.cuda.is_available() else 'cpu'

        print(f"⚡ Initializing VietOCR Engine ({model_name}) on device: {device} with 4 CPU Threads...")
        config = Cfg.load_config_from_name(model_name)
        config['device'] = device
        config['predictor']['beamsearch'] = False

        self.device = device
        self.detector = Predictor(config)

    def predict_crop(self, pil_img: Image.Image) -> str:
        try:
            if pil_img.width < 5 or pil_img.height < 5:
                return ""
            text = self.detector.predict(pil_img)
            return text.strip() if text else ""
        except Exception as e:
            return ""

    def predict_batch(self, pil_imgs: List[Image.Image]) -> List[str]:
        results = []
        for img in pil_imgs:
            results.append(self.predict_crop(img))
        return results
