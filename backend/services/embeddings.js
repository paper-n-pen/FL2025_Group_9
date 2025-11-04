// backend/services/embeddings.js
// Embedding service using Ollama's embeddings API

/**
 * Determine the default base URL based on environment
 */
function getDefaultBaseURL() {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('@db:')) {
    return 'http://host.docker.internal:11434/v1';
  }
  return 'http://localhost:11434/v1';
}

const LLM_BASE_URL = process.env.LLM_BASE_URL || getDefaultBaseURL();
const EMBED_MODEL = process.env.EMBED_MODEL || 'nomic-embed-text';

/**
 * Generate embeddings for an array of texts
 * @param {string[]} texts - Array of text strings to embed
 * @returns {Promise<number[][]>} - Array of embedding vectors
 */
async function embedBatch(texts) {
  if (!texts || texts.length === 0) {
    throw new Error('Texts array cannot be empty');
  }

  const url = `${LLM_BASE_URL}/embeddings`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: texts,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Embeddings HTTP ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  
  if (!data.data || !Array.isArray(data.data)) {
    throw new Error('Invalid embeddings response format');
  }

  return data.data.map(item => item.embedding);
}

/**
 * Generate embedding for a single text
 * @param {string} text - Text string to embed
 * @returns {Promise<number[]>} - Embedding vector
 */
async function embed(text) {
  const embeddings = await embedBatch([text]);
  return embeddings[0];
}

module.exports = { embed, embedBatch };

