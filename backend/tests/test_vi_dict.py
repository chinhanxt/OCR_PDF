import os
import sys
from paddleocr import PaddleOCR

vi_chars = """0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~
aàảãáạăằẳẵắặâầẩẫấậbcdđeèẻẽéẹêềểễếệghiìỉĩíịklmnoòỏõóọôồổỗốộơờởỡớợpqrstuùủũúụưừửữứựvwxyỳỷỹýỵz
AÀẢÃÁẠĂẰẲẴẮẶÂẦẨẪẤẬBCDĐEÈẺẼÉẸÊỀỂỄẾỆGHIÌỈĨÍỊKLMNOÒỎÕÓỌÔỒỔỖỐỘƠỜỞỠỚỢPQRSTUÙỦŨÚỤƯỪỬỮỨỰVWXYỲỶỸÝỴZ
"""

char_set = set()
for char in vi_chars:
    if char != '\n' and char != '\r':
        char_set.add(char)

dict_path = "/home/chinhan/Scan_PDF/backend/vietnamese_dict.txt"
with open(dict_path, "w", encoding="utf-8") as f:
    for c in sorted(list(char_set)):
        f.write(c + "\n")

print(f"Dictionary saved to {dict_path} with {len(char_set)} characters.")

ocr = PaddleOCR(
    use_angle_cls=True,
    lang="vi",
    rec_char_dict_path=dict_path,
    use_gpu=True,
    show_log=False
)

res = ocr.ocr("/home/chinhan/Scan_PDF/storage/pages/6a5fec8c-83d7-4f1d-bfec-95f988f7aac4/page_1.png", cls=True)
if res and res[0]:
    for line in res[0][:15]:
        print(f"{line[1][0]}  [conf: {line[1][1]:.2f}]")
