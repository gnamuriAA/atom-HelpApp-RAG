const fs = require('fs');

// Load the data
console.log('Loading data from ipad-accessories.pdf...\n');

// Simple product extraction from text
function extractProducts(text) {
  const products = [];
  const regex = /\$(\d+\.\d+)\s+([A-Z0-9/-]+(?:AM\/A|LL\/A)?)/g;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    const price = match[1];
    const partNumber = match[2];
    const contextStart = Math.max(0, match.index - 300);
    const contextBefore = text.substring(contextStart, match.index);
    
    const lines = contextBefore.split('\n').map(l => l.trim()).filter(l => l);
    let description = null;
    let name = null;
    
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (line.includes('DESCRIPTION') || line.includes('PRICE') || line.includes('PART NUMBER')) continue;
      
      if (!description && line.length > 10) {
        description = line;
      }
      
      if (line === line.toUpperCase() && line.length > 10 && /[A-Z]/.test(line)) {
        name = line;
        break;
      }
    }
    
    if (description) {
      products.push({
        name: name || description.substring(0, 60),
        description,
        price: `$${price}`,
        part_number: partNumber
      });
    }
  }
  
  return products;
}

// Search function
function searchProduct(query, products) {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\W+/).filter(w => w.length > 2);
  
  // Check for part number in query
  for (const product of products) {
    if (queryLower.includes(product.part_number.toLowerCase())) {
      return product;
    }
  }
  
  // Score by matching words
  let bestMatch = null;
  let bestScore = 0;
  
  for (const product of products) {
    let score = 0;
    const searchText = `${product.name} ${product.description}`.toLowerCase();
    
    queryWords.forEach(word => {
      if (searchText.includes(word)) score++;
    });
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = product;
    }
  }
  
  return bestScore > 0 ? bestMatch : null;
}

// Read PDF text (you'll need to extract this first)
const { spawn } = require('child_process');

const python = spawn('python3', ['-c', `
from HelpPDFReader import extract_text
text = extract_text('ipad-accessories.pdf')
print(text)
`]);

let pdfText = '';
python.stdout.on('data', (data) => {
  pdfText += data.toString();
});

python.on('close', () => {
  console.log('='.repeat(60));
  console.log('Extracting Products from PDF');
  console.log('='.repeat(60) + '\n');
  
  const products = extractProducts(pdfText);
  console.log(`Found ${products.length} products\n`);
  
  // Show first few
  products.slice(0, 5).forEach((p, i) => {
    console.log(`${i+1}. ${p.name}`);
    console.log(`   Part: ${p.part_number}, Price: ${p.price}`);
    console.log(`   Desc: ${p.description.substring(0, 70)}...`);
    console.log();
  });
  
  // Test the exact query
  console.log('='.repeat(60));
  console.log('Testing Query');
  console.log('='.repeat(60) + '\n');
  
  const testQuery = "What is the Part Number of APPLE USB-C POWER ADAPTER (GEN 10 iPAD, iPAD PRO)";
  console.log(`Query: ${testQuery}\n`);
  
  const result = searchProduct(testQuery, products);
  
  if (result) {
    console.log(`✓ Found Match!`);
    console.log(`Product: ${result.name}`);
    console.log(`Answer: Part Number as ${result.part_number} and price as ${result.price}`);
    console.log(`\nFull Details:`);
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('✗ No match found');
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('All Products:');
  console.log('='.repeat(60));
  products.forEach((p, i) => {
    console.log(`${i+1}. ${p.part_number} - ${p.name} - ${p.price}`);
  });
});
