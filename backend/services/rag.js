// backend/services/rag.js
// RAG (Retrieval-Augmented Generation) service for similarity search

const fs = require('fs');
const path = require('path');

let cache = { mtime: 0, index: null };

const INDEX_PATH = path.join(__dirname, '..', 'knowledge', 'index.json');

/**
 * Load the knowledge base index from disk (with caching)
 * @returns {Object|null} - The index object or null if not found
 */
function loadIndex() {
  if (!fs.existsSync(INDEX_PATH)) {
    return null;
  }

  const stats = fs.statSync(INDEX_PATH);
  const mtime = stats.mtimeMs;

  // Return cached index if file hasn't changed
  if (cache.index && cache.mtime === mtime) {
    return cache.index;
  }

  try {
    const indexData = fs.readFileSync(INDEX_PATH, 'utf8');
    cache.index = JSON.parse(indexData);
    cache.mtime = mtime;
    return cache.index;
  } catch (error) {
    console.error('❌ Failed to load RAG index:', error.message);
    return null;
  }
}

/**
 * Calculate cosine similarity between two vectors
 * @param {number[]} a - First vector
 * @param {number[]} b - Second vector
 * @returns {number} - Cosine similarity score
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator > 0 ? dotProduct / denominator : 0;
}

/**
 * Find top-K most similar chunks to a query embedding
 * @param {number[]} queryEmbedding - Query embedding vector
 * @param {number} k - Number of top results to return
 * @returns {Array} - Array of top-K chunks with scores
 */
function similaritySearch(queryEmbedding, k = 5) {
  const index = loadIndex();
  
  if (!index || !index.chunks || index.chunks.length === 0) {
    return [];
  }

  // Calculate similarity scores for all chunks
  const scored = index.chunks.map(chunk => {
    try {
      const score = cosineSimilarity(queryEmbedding, chunk.embedding);
      return {
        ...chunk,
        score: score,
      };
    } catch (error) {
      console.error('❌ Error calculating similarity:', error.message);
      return { ...chunk, score: -1 };
    }
  });

  // Filter out invalid scores and sort by score (descending)
  const validScored = scored.filter(item => item.score >= 0);
  validScored.sort((a, b) => b.score - a.score);

  // Return top-K results
  return validScored.slice(0, k);
}

/**
 * Build context string from retrieved chunks
 * @param {Array} chunks - Array of chunk objects with text, source, and url
 * @returns {string} - Formatted context string
 */
function buildContext(chunks) {
  if (!chunks || chunks.length === 0) {
    return '';
  }

  const contextParts = chunks.map(chunk => {
    let sourceInfo = `[source: ${chunk.source}`;
    if (chunk.url) {
      sourceInfo += ` | ${chunk.url}`;
    }
    sourceInfo += ']';
    
    return `${chunk.text}\n${sourceInfo}`;
  });

  return contextParts.join('\n---\n');
}

module.exports = { loadIndex, similaritySearch, buildContext };

