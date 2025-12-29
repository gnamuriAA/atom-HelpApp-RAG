const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Load embeddings data
console.log('Loading embeddings data...');
const data = JSON.parse(fs.readFileSync('embeddings_data.json', 'utf-8'));
const { chunks, chunks_with_metadata, embeddings, vocabulary, idf_values, pdf_files } = data;
console.log(`✓ Loaded ${chunks.length} chunks from ${pdf_files ? pdf_files.length : 1} PDF(s)!\n`);

// Utility: Calculate cosine similarity
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (normA * normB);
}

// Utility: Transform query text to TF-IDF vector
function transformQuery(queryText) {
  const queryWords = queryText.toLowerCase().split(/\W+/).filter(w => w.length > 0);
  const vector = new Array(vocabulary.length).fill(0);
  
  // Count term frequencies in query
  const termCounts = {};
  queryWords.forEach(word => {
    termCounts[word] = (termCounts[word] || 0) + 1;
  });
  
  // Calculate TF-IDF for query
  queryWords.forEach(word => {
    const idx = vocabulary.indexOf(word);
    if (idx !== -1) {
      const tf = termCounts[word] / queryWords.length;
      const idf = idf_values[idx];
      vector[idx] = tf * idf;
    }
  });
  
  return vector;
}

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    chunks_loaded: chunks.length
  });
});

// Query endpoint
app.post('/query', (req, res) => {
  try {
    const { query, top_k = 3 } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Missing "query" in request body' });
    }
    
    if (typeof top_k !== 'number' || top_k < 1) {
      return res.status(400).json({ error: 'top_k must be a positive integer' });
    }
    
    // Transform query to vector
    const queryVec = transformQuery(query);
    
    // Calculate similarities
    const similarities = embeddings.map(embedding => 
      cosineSimilarity(queryVec, embedding)
    );
    
    // Get top k results
    const indices = similarities
      .map((score, idx) => ({ score, idx }))
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(top_k, chunks.length));
    
    // Format results
    const results = indices.map((item, rank) => ({
      rank: rank + 1,
      score: item.score,
      text: chunks[item.idx],
      source: chunks_with_metadata && chunks_with_metadata[item.idx] 
        ? chunks_with_metadata[item.idx].source 
        : 'unknown'
    }));
    
    res.json({
      query,
      results
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all chunks
app.get('/chunks', (req, res) => {
  res.json({
    total_chunks: chunks.length,
    chunks
  });
});

// Get specific chunk
app.get('/chunks/:id', (req, res) => {
  const chunkId = parseInt(req.params.id);
  
  if (isNaN(chunkId) || chunkId < 0 || chunkId >= chunks.length) {
    return res.status(404).json({ error: 'Chunk ID out of range' });
  }
  
  res.json({
    chunk_id: chunkId,
    text: chunks[chunkId]
  });
});

// Start server
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('RAG API Server (Node.js) Starting...');
  console.log('='.repeat(60));
  console.log('\nAvailable endpoints:');
  console.log(`  GET  http://localhost:${PORT}/health          - Health check`);
  console.log(`  POST http://localhost:${PORT}/query           - Query the knowledge base`);
  console.log(`  GET  http://localhost:${PORT}/chunks          - Get all chunks`);
  console.log(`  GET  http://localhost:${PORT}/chunks/<id>     - Get specific chunk`);
  console.log('\nExample query:');
  console.log(`  curl -X POST http://localhost:${PORT}/query \\`);
  console.log('       -H "Content-Type: application/json" \\');
  console.log('       -d \'{"query": "How do I change my iPad passcode?", "top_k": 2}\'');
  console.log('\n' + '='.repeat(60));
  console.log(`\n✓ Server running on http://localhost:${PORT}\n`);
});
