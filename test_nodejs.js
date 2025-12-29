const http = require('http');

const data = JSON.stringify({
  query: "How do I change my iPad passcode?",
  top_k: 2
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/query',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  
  res.on('data', (chunk) => {
    body += chunk;
  });
  
  res.on('end', () => {
    const response = JSON.parse(body);
    console.log('\n' + '='.repeat(60));
    console.log('Query:', response.query);
    console.log('='.repeat(60));
    console.log('\nResults:\n');
    response.results.forEach(result => {
      console.log(`Rank ${result.rank} (Score: ${result.score.toFixed(3)})`);
      console.log(result.text.substring(0, 150) + '...\n');
    });
    console.log('='.repeat(60) + '\n');
  });
});

req.on('error', (error) => {
  console.error('Error:', error.message);
  console.log('\nMake sure the server is running: node server.js');
});

req.write(data);
req.end();
