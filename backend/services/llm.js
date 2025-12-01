// backend/services/llm.js
// LLM provider using Ollama's OpenAI-compatible API

/**
 * Determine the default base URL based on environment
 * - In Docker: use host.docker.internal to reach host Ollama
 * - Local dev: use localhost
 */
function getDefaultBaseURL() {
  // Check if running in Docker (common indicators)
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('@db:')) {
    // Likely in Docker, use host.docker.internal
    return 'http://host.docker.internal:11434/v1';
  }
  // Local development
  return 'http://localhost:11434/v1';
}

const LLM_BASE_URL = process.env.LLM_BASE_URL || getDefaultBaseURL();
const LLM_MODEL = process.env.LLM_MODEL || 'llama3.2:3b';

/**
 * Send chat completion request to Ollama
 * @param {Array} messages - Array of message objects with role and content
 * @returns {Promise<string>} - The assistant's reply content
 */
async function chat(messages) {
  const url = `${LLM_BASE_URL}/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: messages,
      temperature: 0.5,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`LLM HTTP ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const reply = data?.choices?.[0]?.message?.content;

  if (!reply) {
    throw new Error('LLM service returned no reply content');
  }

  return reply;
}

module.exports = { chat };

