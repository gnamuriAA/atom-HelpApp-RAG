from PyPDF2 import PdfReader

def extract_text(pdf_path):
    reader = PdfReader(pdf_path)
    full_text = ""
    for page in reader.pages:
        txt = page.extract_text()
        if txt:
            full_text += txt + "\n"
    return full_text

if __name__ == "__main__":
    text_content = extract_text("pin_change.pdf")