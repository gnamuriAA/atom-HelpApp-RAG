#!/bin/bash

echo "Starting server in background..."
node server_smart.js > server.log 2>&1 &
SERVER_PID=$!

echo "Server PID: $SERVER_PID"
echo "Waiting for server to start..."
sleep 10

echo -e "\n=== Testing Product Query ===\n"
curl -s -X POST http://localhost:3001/query \
  -H "Content-Type: application/json" \
  -d '{"query":"What is the Part Number of APPLE USB-C POWER ADAPTER (GEN 10 iPAD, iPAD PRO)"}' \
  | python3 -m json.tool

echo -e "\n\n=== Server Log ===\n"
cat server.log

echo -e "\n\nServer is still running (PID: $SERVER_PID)"
echo "To stop: kill $SERVER_PID"
