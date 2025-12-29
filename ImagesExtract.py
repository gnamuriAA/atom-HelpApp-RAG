import fitz  # PyMuPDF
import pytesseract
from PIL import Image
import io
import os
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

def process_pdf(pdf_path):
    """Process a single PDF and return combined text"""
    text_content = extract_text(pdf_path)
    ocr_text = extract_images_with_ocr(pdf_path)
    return text_content + "\n\n" + ocr_text

# List of PDF files to process
pdf_files = [
    "pin_change.pdf",
    "ipad-accessories.pdf"
    # Add your new PDF here, e.g., "another_document.pdf"
]

# Process all PDFs
all_documents = []
for pdf_file in pdf_files:
    if os.path.exists(pdf_file):
        print(f"Processing: {pdf_file}")
        text = process_pdf(pdf_file)
        all_documents.append({
            'source': pdf_file,
            'text': text
        })
    else:
        print(f"Warning: {pdf_file} not found, skipping...")

# Combine all text
final_corpus = "\n\n--- NEW DOCUMENT ---\n\n".join([doc['text'] for doc in all_documents])

splitter = RecursiveCharacterTextSplitter(
    chunk_size=800,
    chunk_overlap=100
)

chunks = splitter.split_text(final_corpus)

# Add metadata to chunks (track which PDF each chunk came from)
chunks_with_metadata = []
for chunk in chunks:
    # Determine source document
    source = "unknown"
    for doc in all_documents:
        if chunk in doc['text']:
            source = doc['source']
            break
    
    chunks_with_metadata.append({
        'text': chunk,
        'source': source
    })

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
    'chunks_with_metadata': chunks_with_metadata,
    'embeddings': embeddings,
    'vectorizer': vectorizer,
    'pdf_files': pdf_files
}

print(f"\nProcessed {len(pdf_files)} PDF(s)")
print(f"Generated {len(chunks)} chunks")
print(f"Saved to embeddings_data.pkl")

with open('embeddings_data.pkl', 'wb') as f:
    pickle.dump(data_to_save, f)
