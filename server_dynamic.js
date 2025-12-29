const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory cache
let cachedData = null;
let lastProcessedTime = null;

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
function transformQuery(queryText, vocabulary, idf_values) {
  const queryWords = queryText.toLowerCase().split(/\W+/).filter(w => w.length > 0);
  const vector = new Array(vocabulary.length).fill(0);
  
  const termCounts = {};
  queryWords.forEach(word => {
    termCounts[word] = (termCounts[word] || 0) + 1;
  });
  
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

// Search products by query (using pre-extracted catalog)
function searchProducts(query, products) {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\W+/).filter(w => w.length > 2);
  
  // Direct part number match
  for (const product of products) {
    if (queryLower.includes(product.part_number.toLowerCase())) {
      return product;
    }
  }
  
  // Score each product
  let bestMatch = null;
  let bestScore = 0;
  
  for (const product of products) {
    let score = 0;
    const searchText = `${product.name} ${product.description} ${product.part_number}`.toLowerCase();
    
    queryWords.forEach(word => {
      if (searchText.includes(word)) {
        score++;
      }
    });
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = product;
    }
  }
  
  return bestScore > 0 ? bestMatch : null;
}

// Format product response
function formatProductResponse(product, query) {
  if (!product) return null;
  
  const queryLower = query.toLowerCase();
  const parts = [];
  
  const askingPartNumber = queryLower.includes('part number') || queryLower.includes('part num');
  const askingPrice = queryLower.includes('price') || queryLower.includes('cost');
  
  if (askingPartNumber || (!askingPrice && !askingPartNumber)) {
    parts.push(`Part Number as ${product.part_number}`);
  }
  
  if (askingPrice || askingPartNumber) {
    parts.push(`price as ${product.price}`);
  }
  
  return {
    answer: parts.join(' and '),
    product_name: product.name,
    full_details: product
  };
}

// Run Python script
function runPythonScript(scriptName) {
  return new Promise((resolve, reject) => {
    console.log(`Running ${scriptName}...`);
    const python = spawn('python3', [scriptName]);
    
    let output = '';
    let errorOutput = '';
    
    python.stdout.on('data', (data) => {
      output += data.toString();
      console.log(data.toString());
    });
    
    python.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${scriptName} failed: ${errorOutput}`));
      } else {
        resolve(output);
      }
    });
  });
}

// Process and load data
async function processAndLoadData(forceReprocess = false) {
  try {
    const needsProcessing = forceReprocess || 
                           !fs.existsSync('embeddings_data.json') ||
                           !cachedData;
    
    if (needsProcessing) {
      console.log('\n' + '='.repeat(60));
      console.log('Processing PDFs and generating embeddings...');
      console.log('='.repeat(60));
      
      await runPythonScript('ImagesExtract.py');
      await runPythonScript('export_to_json.py');
      
      console.log('='.repeat(60));
      console.log('Processing complete!');
      console.log('='.repeat(60) + '\n');
    }
    
    console.log('Loading embeddings data...');
    const data = JSON.parse(fs.readFileSync('embeddings_data.json', 'utf-8'));
    cachedData = data;
    lastProcessedTime = new Date();
    
    console.log(`✓ Loaded ${data.chunks.length} chunks from ${data.pdf_files ? data.pdf_files.length : 1} PDF(s)!`);
    if (data.products) {
      console.log(`✓ Loaded ${data.products.length} structured products\n`);
    }
    
    return data;
  } catch (error) {
    console.error('Error processing data:', error);
    throw error;
  }
}

// Health check
app.get('/health', async (req, res) => {
  try {
    if (!cachedData) {
      await processAndLoadData();
    }
    
    res.json({
      status: 'healthy',
      chunks_loaded: cachedData.chunks.length,
      products_extracted: cachedData.products ? cachedData.products.length : 0,
      vocabulary_size: cachedData.vocabulary ? cachedData.vocabulary.length : 0,
      last_processed: lastProcessedTime,
      pdf_files: cachedData.pdf_files || []
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      error: error.message 
    });
  }
});

// Smart query endpoint
app.post('/query', async (req, res) => {
  try {
    const { query, top_k = 3, reprocess = false, use_structured = true } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Missing "query" in request body' });
    }
    
    if (typeof top_k !== 'number' || top_k < 1) {
      return res.status(400).json({ error: 'top_k must be a positive integer' });
    }
    
    // Load data if needed
    if (!cachedData || reprocess) {
      await processAndLoadData(reprocess);
    }
    
    // Check if this is a product-specific query
    const isProductQuery = query.toLowerCase().includes('part number') || 
                          query.toLowerCase().includes('price') ||
                          query.toLowerCase().includes('cost');
    
    if (isProductQuery && use_structured && cachedData.products) {
      // Use structured product catalog
      const product = searchProducts(query, cachedData.products);
      
      if (product) {
        const response = formatProductResponse(product, query);
        return res.json({
          query,
          answer: response.answer,
          method: 'structured_extraction',
          product: response.full_details,
          processed_at: lastProcessedTime
        });
      }
    }
    
    // Fallback to semantic search with TF-IDF
    const { chunks, chunks_with_metadata, embeddings, vocabulary, idf_values } = cachedData;
    const queryVec = transformQuery(query, vocabulary, idf_values);
    
    const similarities = embeddings.map(embedding => 
      cosineSimilarity(queryVec, embedding)
    );
    
    const indices = similarities
      .map((score, idx) => ({ score, idx }))
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(top_k, chunks.length));
    
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
      results,
      method: 'semantic_search',
      processed_at: lastProcessedTime
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get products endpoint
app.get('/products', async (req, res) => {
  try {
    if (!cachedData) {
      await processAndLoadData();
    }
    
    res.json({
      total_products: cachedData.products ? cachedData.products.length : 0,
      products: cachedData.products || []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Force reprocess
app.post('/reprocess', async (req, res) => {
  try {
    console.log('\nForce reprocessing requested...');
    await processAndLoadData(true);
    
    res.json({
      status: 'success',
      message: 'PDFs reprocessed successfully',
      chunks: cachedData.chunks.length,
      products: cachedData.products ? cachedData.products.length : 0,
      processed_at: lastProcessedTime
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      error: error.message 
    });
  }
});

// Get all chunks
app.get('/chunks', async (req, res) => {
  try {
    if (!cachedData) {
      await processAndLoadData();
    }
    
    res.json({
      total_chunks: cachedData.chunks.length,
      chunks: cachedData.chunks
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific chunk
app.get('/chunks/:id', async (req, res) => {
  try {
    if (!cachedData) {
      await processAndLoadData();
    }
    
    const chunkId = parseInt(req.params.id);
    
    if (isNaN(chunkId) || chunkId < 0 || chunkId >= cachedData.chunks.length) {
      return res.status(404).json({ error: 'Chunk ID out of range' });
    }
    
    res.json({
      chunk_id: chunkId,
      text: cachedData.chunks[chunkId],
      source: cachedData.chunks_with_metadata && cachedData.chunks_with_metadata[chunkId]
        ? cachedData.chunks_with_metadata[chunkId].source
        : 'unknown'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('RAG API Server with Optimized Product Extraction');
  console.log('='.repeat(60));
  console.log('\nAvailable endpoints:');
  console.log(`  GET  http://localhost:${PORT}/health          - Health check`);
  console.log(`  POST http://localhost:${PORT}/query           - Smart query (structured + semantic)`);
  console.log(`  GET  http://localhost:${PORT}/products        - Get all extracted products`);
  console.log(`  POST http://localhost:${PORT}/reprocess       - Force reprocess PDFs`);
  console.log(`  GET  http://localhost:${PORT}/chunks          - Get all chunks`);
  console.log(`  GET  http://localhost:${PORT}/chunks/<id>     - Get specific chunk`);
  console.log('\nExample queries:');
  console.log(`  curl -X POST http://localhost:${PORT}/query \\`);
  console.log('       -H "Content-Type: application/json" \\');
  console.log('       -d \'{"query": "What is the Part Number of APPLE USB-C POWER ADAPTER (GEN 10 iPAD, iPAD PRO)"}\'');
  console.log('\n' + '='.repeat(60));
  console.log(`\n✓ Server running on http://localhost:${PORT}\n`);
});
