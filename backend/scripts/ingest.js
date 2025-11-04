// backend/scripts/ingest.js
// Ingest markdown files, chunk them, generate embeddings, and create index

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { embedBatch } = require('../services/embeddings');

const KNOWLEDGE_DIR = path.join(__dirname, '..', 'knowledge');
const MANUAL_DIR = path.join(KNOWLEDGE_DIR, 'manual');
const PAGES_DIR = path.join(KNOWLEDGE_DIR, 'pages');
const INDEX_PATH = path.join(KNOWLEDGE_DIR, 'index.json');

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 150;
const EMBED_MODEL = process.env.EMBED_MODEL || 'nomic-embed-text';

/**
 * Read all markdown files from a directory
 * @param {string} dir - Directory path
 * @returns {Array<{file: string, content: string, source: string}>}
 */
function readMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const files = fs.readdirSync(dir);
  const markdownFiles = files.filter(f => f.endsWith('.md'));

  return markdownFiles.map(file => {
    const filePath = path.join(dir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(KNOWLEDGE_DIR, filePath).replace(/\\/g, '/');
    return { file, content, source: relativePath };
  });
}

/**
 * Split text into chunks with overlap
 * @param {string} text - Text to chunk
 * @param {number} chunkSize - Maximum chunk size
 * @param {number} overlap - Overlap between chunks
 * @returns {Array<string>} - Array of text chunks
 */
function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  if (!text || text.length === 0) {
    return [];
  }

  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    let chunk = text.slice(start, end);

    // Try to break at sentence or paragraph boundary
    if (end < text.length) {
      const lastPeriod = chunk.lastIndexOf('.');
      const lastNewline = chunk.lastIndexOf('\n\n');
      const breakPoint = Math.max(lastNewline, lastPeriod);
      
      if (breakPoint > chunkSize * 0.5) {
        chunk = chunk.slice(0, breakPoint + 1);
        start = start + breakPoint + 1;
      } else {
        start = end - overlap;
      }
    } else {
      start = end;
    }

    chunk = chunk.trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
  }

  return chunks;
}

/**
 * Generate line range info for a chunk
 * @param {string} content - Full content
 * @param {string} chunk - Chunk text
 * @param {number} chunkIndex - Chunk index
 * @returns {string} - Source location string
 */
function getChunkLocation(content, chunk, chunkIndex) {
  const lines = content.split('\n');
  const chunkStart = content.indexOf(chunk);
  
  if (chunkStart === -1) {
    return `chunk${chunkIndex + 1}`;
  }

  let lineNum = content.substring(0, chunkStart).split('\n').length;
  const chunkLines = chunk.split('\n').length;
  
  if (chunkLines === 1) {
    return `L${lineNum}`;
  }
  return `L${lineNum}-${lineNum + chunkLines - 1}`;
}

/**
 * Main ingest function
 */
async function main() {
  console.log('📚 Starting knowledge base ingestion...\n');

  // Ensure knowledge directory exists
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
  }

  // Read markdown files
  const manualFiles = readMarkdownFiles(MANUAL_DIR);
  const pageFiles = readMarkdownFiles(PAGES_DIR);
  const allFiles = [...manualFiles, ...pageFiles];

  if (allFiles.length === 0) {
    console.log('⚠️  No markdown files found in knowledge/manual or knowledge/pages');
    console.log('💡 Create some .md files or run `npm run kb:crawl` first.\n');
    return;
  }

  console.log(`📄 Found ${allFiles.length} markdown file(s):`);
  allFiles.forEach(f => console.log(`   - ${f.source}`));
  console.log('');

  // Chunk all files
  const allChunks = [];
  let chunkId = 0;

  for (const file of allFiles) {
    const chunks = chunkText(file.content);
    
    console.log(`📦 Chunking ${file.source}: ${chunks.length} chunk(s)`);

    chunks.forEach((chunk, idx) => {
      const location = getChunkLocation(file.content, chunk, idx);
      allChunks.push({
        id: `chunk_${chunkId++}`,
        source: `${file.source}#${location}`,
        url: file.source.startsWith('pages/') ? file.source.replace('pages/', '').replace('.md', '') : null,
        text: chunk,
        embedding: null, // Will be filled after embedding
      });
    });
  }

  console.log(`\n🔢 Total chunks: ${allChunks.length}`);

  // Generate embeddings in batches
  console.log(`\n🧮 Generating embeddings using model: ${EMBED_MODEL}...`);
  
  const batchSize = 10; // Process in batches to avoid overwhelming the API
  let processed = 0;

  for (let i = 0; i < allChunks.length; i += batchSize) {
    const batch = allChunks.slice(i, i + batchSize);
    const texts = batch.map(c => c.text);
    
    try {
      const embeddings = await embedBatch(texts);
      
      batch.forEach((chunk, idx) => {
        chunk.embedding = embeddings[idx];
      });

      processed += batch.length;
      console.log(`   ✅ Embedded ${processed}/${allChunks.length} chunks...`);

      // Small delay between batches
      if (i + batchSize < allChunks.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.error(`❌ Error embedding batch ${i}-${i + batchSize}:`, error.message);
      throw error;
    }
  }

  // Create index structure
  const index = {
    meta: {
      model: EMBED_MODEL,
      updatedAt: new Date().toISOString(),
      totalChunks: allChunks.length,
      totalFiles: allFiles.length,
    },
    chunks: allChunks,
  };

  // Write index to disk
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2), 'utf8');

  console.log(`\n✅ Index saved to: ${INDEX_PATH}`);
  console.log(`📊 Index contains ${allChunks.length} chunks from ${allFiles.length} files`);
  console.log(`\n✨ Ingestion complete! The chatbot can now use RAG.\n`);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Ingestion failed:', error);
    process.exit(1);
  });
}

module.exports = { chunkText, readMarkdownFiles };

