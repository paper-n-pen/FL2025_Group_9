// backend/scripts/crawl.js
// Web crawler to fetch and extract content from website pages

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
require('dotenv').config();

const KNOWLEDGE_DIR = path.join(__dirname, '..', 'knowledge');
const PAGES_DIR = path.join(KNOWLEDGE_DIR, 'pages');
const CONFIG_PATH = path.join(KNOWLEDGE_DIR, 'crawl.config.json');

/**
 * Extract visible text from HTML
 * @param {string} html - HTML content
 * @returns {string} - Extracted text content
 */
function extractText(html) {
  const $ = cheerio.load(html);
  
  // Remove script and style elements
  $('script, style, noscript').remove();
  
  // Extract text from body
  const text = $('body').text() || $('html').text();
  
  // Clean up whitespace
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();
}

/**
 * Convert path to a safe filename
 * @param {string} pathStr - URL path
 * @returns {string} - Safe filename
 */
function pathToSlug(pathStr) {
  return pathStr
    .replace(/^\//, '')
    .replace(/\//g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'index';
}

/**
 * Fetch a single URL and extract content
 * @param {string} url - Full URL to fetch
 * @param {string} slug - Filename slug
 * @returns {Promise<{success: boolean, slug: string, url: string, content?: string}>}
 */
async function fetchPage(url, slug) {
  try {
    console.log(`📥 Fetching: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MicroTutor-Knowledge-Base-Crawler/1.0',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`⚠️  404 Not Found: ${url}`);
        return { success: false, slug, url, error: 'Not Found' };
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      console.log(`⚠️  Skipping non-HTML content: ${url} (${contentType})`);
      return { success: false, slug, url, error: 'Not HTML' };
    }

    const html = await response.text();
    const text = extractText(html);

    if (!text || text.length < 50) {
      console.log(`⚠️  Insufficient content extracted from: ${url}`);
      return { success: false, slug, url, error: 'Insufficient content' };
    }

    return { success: true, slug, url, content: text };
  } catch (error) {
    console.error(`❌ Error fetching ${url}:`, error.message);
    return { success: false, slug, url, error: error.message };
  }
}

/**
 * Main crawl function
 */
async function main() {
  console.log('🕷️  Starting web crawl...\n');

  // Ensure directories exist
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
  }
  if (!fs.existsSync(PAGES_DIR)) {
    fs.mkdirSync(PAGES_DIR, { recursive: true });
  }

  // Load config
  if (!fs.existsSync(CONFIG_PATH)) {
    console.log('⚠️  No crawl.config.json found. Creating default config...');
    const defaultConfig = {
      baseUrl: 'http://localhost:5173',
      paths: ['/'],
    };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
    console.log('✅ Created default crawl.config.json');
    console.log('📝 Please edit knowledge/crawl.config.json and run again.\n');
    return;
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const { baseUrl, paths } = config;

  if (!baseUrl || !Array.isArray(paths) || paths.length === 0) {
    console.error('❌ Invalid crawl.config.json: need baseUrl and paths array');
    process.exit(1);
  }

  console.log(`📋 Base URL: ${baseUrl}`);
  console.log(`📋 Paths to crawl: ${paths.length}\n`);

  const results = [];

  for (const pathStr of paths) {
    const fullUrl = `${baseUrl}${pathStr}`;
    const slug = pathToSlug(pathStr);
    const result = await fetchPage(fullUrl, slug);
    
    if (result.success && result.content) {
      const filePath = path.join(PAGES_DIR, `${slug}.md`);
      fs.writeFileSync(filePath, result.content, 'utf8');
      console.log(`✅ Saved: ${filePath} (${result.content.length} chars)`);
    }
    
    results.push(result);
    
    // Small delay to be respectful
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n📊 Crawl Summary:');
  const successful = results.filter(r => r.success).length;
  console.log(`✅ Successful: ${successful}/${results.length}`);
  console.log(`❌ Failed: ${results.length - successful}/${results.length}`);
  
  if (successful > 0) {
    console.log('\n✨ Crawl complete! Run `npm run kb:ingest` to generate embeddings.');
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Crawl failed:', error);
    process.exit(1);
  });
}

module.exports = { fetchPage, extractText, pathToSlug };

