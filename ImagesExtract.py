import fitz  # PyMuPDF
import pytesseract
from PIL import Image
import io
from HelpPDFReader import extract_text
from langchain.text_splitter import RecursiveCharacterTextSplitter

def extract_images_with_ocr(pdf_path):
    doc = fitz.open(pdf_path)
    ocr_text = ""
    for page_index in range(len(doc)):
        page = doc[page_index]
        images = page.get_images(full=True)

        for imge_index, img_info in enumerate(images):
            xref = img_info[0]
            base_image = doc.extract_image(xref)
            img_bytes = base_image["image"]
            img = Image.open(io.BytesIO(img_bytes))

            # OCR
            try:
                extracted = pytesseract.image_to_string(img)
                ocr_text += extracted + "\n"
            except Exception as e:
                pass

    return ocr_text

# Extract text using both methods
text_content = extract_text("pin_change.pdf")
ocr_text = extract_images_with_ocr("pin_change.pdf")
final_corpus = text_content + "\n\n" + ocr_text

splitter = RecursiveCharacterTextSplitter(
    chunk_size=800,
    chunk_overlap=100
)

chunks = splitter.split_text(final_corpus)

# Simple local embedding using TF-IDF (no download needed)
from sklearn.feature_extraction.text import TfidfVectorizer
import numpy as np
import pickle
from sklearn.metrics.pairwise import cosine_similarity

# Create TF-IDF vectorizer
vectorizer = TfidfVectorizer(max_features=384, stop_words='english')
embeddings = vectorizer.fit_transform(chunks).toarray()

# Save chunks and embeddings for later use
data_to_save = {
    'chunks': chunks,
    'embeddings': embeddings,
    'vectorizer': vectorizer
}

with open('embeddings_data.pkl', 'wb') as f:
    pickle.dump(data_to_save, f)
