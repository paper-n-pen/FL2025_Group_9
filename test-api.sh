#!/bin/bash
# Quick API test script

echo "=== Testing /api/health ==="
curl -s http://localhost:3000/api/health | jq .
echo ""

echo "=== Testing POST /api/auth/register (student) ==="
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"role":"student","name":"Alice","email":"alice@test.com","password":"secret12"}' | jq .
echo ""

echo "=== Testing POST /api/register (backward compat) ==="
curl -s -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"role":"student","name":"Bob","email":"bob@test.com","password":"secret12"}' | jq .
echo ""

echo "=== Testing POST /api/auth/login ==="
curl -i -c /tmp/cookies.txt -b /tmp/cookies.txt \
  -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@test.com","password":"secret12"}' | head -20
echo ""

echo "=== Testing GET /api/auth/me ==="
curl -s -b /tmp/cookies.txt http://localhost:3000/api/auth/me | jq .
echo ""

