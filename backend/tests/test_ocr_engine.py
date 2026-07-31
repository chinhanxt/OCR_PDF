import os
import pytest
from PIL import Image, ImageDraw
from ocr_engine import OCREngine

def test_ocr_engine_gpu_and_detection(tmp_path):
    img_path = str(tmp_path / "test_ocr.png")
    img = Image.new('RGB', (400, 100), color=(255, 255, 255))
    d = ImageDraw.Draw(img)
    d.text((20, 30), "Cong viec 1.3: Phat trien", fill=(0, 0, 0))
    img.save(img_path)

    engine = OCREngine()
    results = engine.scan_image(img_path)
    assert len(results) > 0
    assert any("Cong viec" in r["text"] or "Phat trien" in r["text"] for r in results)
