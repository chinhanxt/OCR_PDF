import os
import torch
from PIL import Image
from vietocr.tool.predictor import Predictor
from vietocr.tool.config import Cfg

class VietOCREngine:
    def __init__(self, model_name: str = 'vgg_transformer', device: str = None):
        if device is None:
            device = 'cuda:0' if torch.cuda.is_available() else 'cpu'

        print(f"⚡ Initializing VietOCR Engine ({model_name}) on device: {device}...")
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
            print(f"VietOCR Error: {e}")
            return ""
