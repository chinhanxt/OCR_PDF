import os
import sys
import fitz

# Ensure backend directory is in python path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from pdf_builder import PDFBuilder

def verify_e2e():
    input_pdf = "/home/chinhan/Downloads/1. TTr_PTAP_daduyet_250725.pdf"
    output_pdf = "/home/chinhan/Scan_PDF/storage/outputs/sample_e2e_searchable.pdf"
    pages_dir = "/home/chinhan/Scan_PDF/storage/pages/e2e_sample"

    os.makedirs(os.path.dirname(output_pdf), exist_ok=True)
    os.makedirs(pages_dir, exist_ok=True)

    print(f"Starting E2E verification on input: {input_pdf}")
    builder = PDFBuilder()
    metadata = builder.process_pdf(input_pdf, output_pdf, pages_dir)

    print("OCR Processing finished.")
    print(f"Total pages processed: {metadata['total_pages']}")

    # 1. Verify output PDF exists
    assert os.path.exists(output_pdf), f"Output PDF {output_pdf} does not exist!"
    print("✓ Verification 1: Output PDF file exists.")

    # 2. Verify output PDF is non-empty
    file_size = os.path.getsize(output_pdf)
    assert file_size > 0, f"Output PDF file size is 0 bytes!"
    print(f"✓ Verification 2: Output PDF file is non-empty ({file_size / (1024*1024):.2f} MB).")

    # 3. Verify searchable text layers in output PDF using PyMuPDF
    doc = fitz.open(output_pdf)
    assert len(doc) > 0, "Output PDF has no pages!"

    all_extracted_text = ""
    for page_num in range(len(doc)):
        page_text = doc[page_num].get_text()
        all_extracted_text += f"\n--- Page {page_num+1} ---\n" + page_text

    doc.close()

    assert len(all_extracted_text.strip()) > 0, "No text layer found in output PDF!"
    print(f"✓ Verification 3: Output PDF contains searchable text layer ({len(all_extracted_text)} characters extracted).")

    # 4. Check for Vietnamese financial table names & numbers
    expected_keywords = ["Huỳnh Quốc Bảo", "24,000,000", "40,000,000", "72,000,000"]
    
    all_ocr_items_text = " ".join(
        item["text"] 
        for page in metadata["pages"] 
        for item in page["ocr_items"]
    )
    combined_text = all_extracted_text + "\n" + all_ocr_items_text

    print("\nVerifying target Vietnamese names and financial figures:")
    found_count = 0
    for kw in expected_keywords:
        found = kw in combined_text
        if found:
            found_count += 1
            print(f"  ✓ Found keyword: '{kw}'")
        else:
            print(f"  ✗ Missing keyword: '{kw}'")

    assert found_count > 0, f"None of the target keywords {expected_keywords} were found!"
    print(f"✓ Verification 4: Vietnamese names/numbers successfully verified ({found_count}/{len(expected_keywords)} keywords matched).")

    print("\n==========================================")
    print("E2E VERIFICATION COMPLETED SUCCESSFULLY!")
    print("==========================================")

if __name__ == "__main__":
    verify_e2e()
