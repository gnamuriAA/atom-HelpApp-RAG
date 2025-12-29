# RAG API - Hybrid Python + Node.js

## 🎯 Architecture Overview

**Python** → Data Processing (PDF extraction, OCR, embeddings)  
**Node.js** → API Server (fast, scalable web service)

---

## 📦 Setup

### 1. Python Dependencies (Already installed)
```bash
pip install PyMuPDF pytesseract Pillow PyPDF2 langchain scikit-learn
brew install tesseract
```

### 2. Node.js Dependencies
```bash
npm install
```

---

## 🚀 Usage

### **Step 1: Process PDF (Python - One time)**
```bash
python3 ImagesExtract.py
```
This creates `embeddings_data.pkl`

### **Step 2: Export to JSON (One time)**
```bash
python3 export_to_json.py
```
This creates `embeddings_data.json` for Node.js

### **Step 3: Start Node.js API Server**
```bash
npm start
# or with auto-reload:
npm run dev
```

Server runs on: `http://localhost:3000`

---

## 🔌 API Endpoints

### 1. **Health Check**
```bash
GET /health
```

**Example:**
```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "healthy",
  "chunks_loaded": 6
}
```

---

### 2. **Query (Semantic Search)**
```bash
POST /query
```

**Request Body:**
```json
{
  "query": "How do I change my iPad passcode?",
  "top_k": 2
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/query \
     -H "Content-Type: application/json" \
     -d '{"query": "How do I change my iPad passcode?", "top_k": 2}'
```

**Response:**
```json
{
  "query": "How do I change my iPad passcode?",
  "results": [
    {
      "rank": 1,
      "score": 0.332,
      "text": "Add a Fingerprint. Turn Passcode Off. Change Passcode..."
    },
    {
      "rank": 2,
      "score": 0.328,
      "text": "Tech Ops Mobility iPad Pin Change 1. Open Settings..."
    }
  ]
}
```

---

### 3. **Get All Chunks**
```bash
GET /chunks
```

**Example:**
```bash
curl http://localhost:3000/chunks
```

---

### 4. **Get Specific Chunk**
```bash
GET /chunks/:id
```

**Example:**
```bash
curl http://localhost:3000/chunks/0
```

---

## 🧪 Testing

### Node.js Test:
```bash
node test_nodejs.js
```

### Python Test:
```bash
python3 test_api.py
```

---

## 📁 Project Structure

```
HelpApp/
├── ImagesExtract.py          # PDF processing & OCR (Python)
├── HelpPDFReader.py           # Direct PDF text extraction
├── export_to_json.py          # Convert pickle to JSON
├── embeddings_data.pkl        # Python embeddings (pickle)
├── embeddings_data.json       # Node.js embeddings (JSON)
├── server.js                  # Node.js API server
├── api.py                     # Flask API (alternative)
├── test_nodejs.js             # Node.js API test
├── test_api.py                # Python API test
└── package.json               # Node.js dependencies
```

---

## 🔄 Workflow

```
1. PDF Document
   ↓
2. Python Processing (ImagesExtract.py)
   - Extract text from PDF
   - OCR images
   - Create embeddings
   ↓
3. Export to JSON (export_to_json.py)
   ↓
4. Node.js API (server.js)
   - Load embeddings
   - Serve HTTP requests
   - Return search results
```

---

## ⚙️ Configuration

**Node.js Port:** Change in `server.js`
```javascript
const PORT = 3000;  // Change to your preferred port
```

**Python Port (Flask):** Change in `api.py`
```python
app.run(debug=True, host='0.0.0.0', port=5001)
```

---

## 🎯 Why Hybrid Approach?

| Aspect | Python | Node.js |
|--------|--------|---------|
| PDF Processing | ✅ Excellent (PyMuPDF) | ❌ Limited |
| OCR | ✅ Tesseract (Best) | ⚠️ tesseract.js (Slower) |
| ML/Embeddings | ✅ scikit-learn | ❌ Limited |
| API Performance | ⚠️ Good | ✅ Excellent |
| Scalability | ⚠️ Good | ✅ Excellent |
| Async I/O | ⚠️ asyncio | ✅ Built-in |

**Result:** Use Python for heavy lifting, Node.js for serving!

---

## 📝 Notes

- Re-run Python scripts only when PDF content changes
- Node.js server reads static JSON file (very fast)
- No ML processing during API requests
- All embeddings pre-computed

---

## 🚀 Production Deployment

For production, consider:
- Use PM2 for Node.js process management
- Add authentication/rate limiting
- Use nginx as reverse proxy
- Enable HTTPS
- Add logging and monitoring
