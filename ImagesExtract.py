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
    """Process a single PDF and return text only (OCR disabled)"""
    text_content = extract_text(pdf_path)
    # ocr_text = extract_images_with_ocr(pdf_path)
    # return text_content + "\n\n" + ocr_text
    return text_content

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

# Simple local embedding using TF-IDF (optimized for product data)
from sklearn.feature_extraction.text import TfidfVectorizer
import numpy as np
import pickle
import re

# Optimized TF-IDF vectorizer with better settings for product catalogs
vectorizer = TfidfVectorizer(
    max_features=512,  # Increased from 384 for better coverage
    stop_words='english',
    ngram_range=(1, 2),  # Include bigrams for better phrase matching
    min_df=1,  # Include rare terms (important for specific product names)
    max_df=0.95,  # Remove very common terms
    sublinear_tf=True  # Use log scaling for term frequency
)

print("\nGenerating optimized TF-IDF embeddings...")
embeddings = vectorizer.fit_transform(chunks).toarray()

# Extract structured product information for fast lookup
def extract_product_catalog(text):
    """Extract structured product information from PDFs"""
    products = []
    # Pattern: Find price ($XX.XX) followed by part number
    price_part_pattern = r'\$(\d+\.\d+)\s+([A-Z0-9/-]+)'
    
    matches = re.finditer(price_part_pattern, text)
    
    for match in matches:
        price = match.group(1)
        part_number = match.group(2)
        match_pos = match.start()
        
        # Get context (300 chars before)
        context_start = max(0, match_pos - 300)
        context = text[context_start:match_pos]
        
        lines = [l.strip() for l in context.split('\n') if l.strip()]
        
        description = None
        product_name = None
        
        # Find description and name
        for i in range(len(lines) - 1, -1, -1):
            line = lines[i]
            
            # Skip headers
            if any(keyword in line for keyword in ['DESCRIPTION', 'PRICE', 'PART NUMBER', 'PICTURE']):
                continue
            
            # First good line is description
            if not description and len(line) > 10 and not line.startswith('$'):
                description = line
            
            # ALL CAPS lines are product names
            if line.isupper() and len(line) > 10 and re.search(r'[A-Z]{3,}', line):
                product_name = line
                break
        
        if description:
            products.append({
                'name': product_name or description[:60],
                'description': description,
                'price': f'${price}',
                'part_number': part_number,
                'full_text': context[-200:] + f' ${price} {part_number}'
            })
    
    return products

# Extract product catalog from all documents
print("Extracting product catalog...")
all_products = []
for doc in all_documents:
    products = extract_product_catalog(doc['text'])
    for product in products:
        product['source'] = doc['source']
    all_products.extend(products)

print(f"Extracted {len(all_products)} products")

# Save chunks and embeddings for later use
data_to_save = {
    'chunks': chunks,
    'chunks_with_metadata': chunks_with_metadata,
    'embeddings': embeddings,
    'vectorizer': vectorizer,
    'pdf_files': pdf_files,
    'products': all_products  # Add product catalog
}

print(f"\nProcessed {len(pdf_files)} PDF(s)")
print(f"Generated {len(chunks)} chunks")
print(f"Extracted {len(all_products)} structured products")
print(f"Embedding dimensions: {embeddings.shape[1]}")
print(f"Saved to embeddings_data.pkl")

with open('embeddings_data.pkl', 'wb') as f:
    pickle.dump(data_to_save, f)
