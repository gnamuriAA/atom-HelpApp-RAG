# Adding Multiple PDFs to Your RAG System

## Quick Steps:

### 1. Add your new PDF file
Place your new PDF file in the same directory as `pin_change.pdf`

Example:
```
/Users/980626/Documents/RAG/HelpApp/
├── pin_change.pdf
├── your_new_document.pdf  ← Add here
```

### 2. Update ImagesExtract.py
Open `ImagesExtract.py` and add your PDF to the list (around line 42):

```python
# List of PDF files to process
pdf_files = [
    "pin_change.pdf",
    "your_new_document.pdf",  # ← Add your PDF here
    # "another_file.pdf",     # ← Can add more
]
```

### 3. Re-run the processing
```bash
python3 ImagesExtract.py
```

This will:
- Extract text from all PDFs
- Perform OCR on images
- Create new embeddings
- Track which chunks came from which PDF

### 4. Export to JSON for Node.js
```bash
python3 export_to_json.py
```

### 5. Restart the Node.js server
```bash
# Stop the current server (Ctrl+C if running)
node server.js
```

### 6. Test with queries
```bash
curl -X POST http://localhost:3001/query \
  -H "Content-Type: application/json" \
  -d '{"query": "your question here", "top_k": 3}'
```

## What's New:

### Response now includes source information:
```json
{
  "query": "How do I change my iPad passcode?",
  "results": [
    {
      "rank": 1,
      "score": 0.332,
      "text": "...",
      "source": "pin_change.pdf"  ← Shows which PDF
    },
    {
      "rank": 2,
      "score": 0.215,
      "text": "...",
      "source": "your_new_document.pdf"  ← Shows which PDF
    }
  ]
}
```

## Example with Multiple PDFs:

```python
pdf_files = [
    "pin_change.pdf",
    "password_reset.pdf",
    "account_setup.pdf",
    "troubleshooting.pdf"
]
```

The system will:
- Process all 4 PDFs
- Create chunks from all documents
- Generate unified embeddings
- Allow querying across all documents
- Show which PDF each result came from

## Notes:

- ✅ Can add unlimited PDFs
- ✅ System searches across all documents
- ✅ Results show source PDF
- ✅ No code changes needed after initial setup
- ⚠️ Re-run steps 3-5 when adding new PDFs
