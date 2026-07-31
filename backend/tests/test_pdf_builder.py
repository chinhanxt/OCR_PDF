import os
import fitz
import pytest
from pdf_builder import PDFBuilder

def test_pdf_conversion_and_searchable_build(tmp_path):
    sample_pdf = str(tmp_path / "sample.pdf")
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text((50, 50), "Test Document Title")
    doc.save(sample_pdf)
    doc.close()

    output_pdf = str(tmp_path / "output_searchable.pdf")
    builder = PDFBuilder()
    metadata = builder.process_pdf(sample_pdf, output_pdf)

    assert os.path.exists(output_pdf)
    assert len(metadata["pages"]) == 1
    assert "page_number" in metadata["pages"][0]
