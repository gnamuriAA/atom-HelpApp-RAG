"""
Export embeddings data from pickle to JSON format for Node.js
"""
import pickle
import json
import numpy as np

# Load pickle data
with open('embeddings_data.pkl', 'rb') as f:
    data = pickle.load(f)

# Convert numpy arrays to lists for JSON serialization
export_data = {
    'chunks': data['chunks'],
    'chunks_with_metadata': data.get('chunks_with_metadata', []),
    'embeddings': data['embeddings'].tolist(),  # Convert numpy array to list
    'vocabulary': data['vectorizer'].get_feature_names_out().tolist(),
    'idf_values': data['vectorizer'].idf_.tolist(),
    'pdf_files': data.get('pdf_files', [])
}

# Save as JSON
with open('embeddings_data.json', 'w', encoding='utf-8') as f:
    json.dump(export_data, f, ensure_ascii=False, indent=2)

print("✓ Exported embeddings to embeddings_data.json")
print(f"  - {len(export_data['chunks'])} chunks")
print(f"  - {len(export_data['embeddings'])} embeddings")
print(f"  - {len(export_data['vocabulary'])} vocabulary terms")
print(f"  - {len(export_data['pdf_files'])} PDF files")
