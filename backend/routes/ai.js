// backend/routes/ai.js
const express = require("express");
const router = express.Router();
const { chat } = require("../services/llm");
const { embed } = require("../services/embeddings");
const { loadIndex, similaritySearch, buildContext } = require("../services/rag");
const { detectIntent } = require("../services/intent");
const {
  getTutorByName,
  listTutorsBySubject,
  getPricingSummary,
  getTutorRatings,
  getPolicy,
  listAllTutors,
} = require("../services/botTools");

const RAG_TOP_K = parseInt(process.env.RAG_TOP_K || "5", 10);

/**
 * Format price as currency - show exactly as set (no decimals)
 * @param {number} price - Price value
 * @returns {string} - Formatted price string (e.g., "$100")
 */
function formatPrice(price) {
  if (!price || price === null || price === undefined) {
    return 'Not set';
  }
  // Round to nearest whole number and show without decimals
  const rounded = Math.round(price);
  return `$${rounded}`;
}

/**
 * Extract query from recent user messages
 * @param {Array} messages - Array of message objects
 * @returns {string} - Query string from last user message
 */
function extractQuery(messages) {
  // Get last user message
  const userMessages = messages
    .filter(msg => msg.role === "user")
    .slice(-1)
    .map(msg => msg.content);

  return userMessages[0] || "";
}

/**
 * Build DB context block from bot tools results
 * @param {Object} intent - Detected intent
 * @returns {Promise<string>} - DB context string
 */
async function buildDBContext(intent) {
  const dbBlocks = [];

  try {
    switch (intent.type) {
      case 'tutor_price_by_name': {
        const name = intent.slots.name;
        if (name) {
          console.log(`🔍 Looking up tutor: "${name}"`);
          const tutor = await getTutorByName(name);
          if (tutor) {
            dbBlocks.push(
              `Tutor: ${tutor.name} | Subjects: ${tutor.subjects.join(', ') || 'N/A'} | ` +
              `Price: ${formatPrice(tutor.price_per_hour)}/hr ` +
              `(${formatPrice(tutor.rate_per_10_min)}/10min) | ` +
              `Rating: ${tutor.rating || 'N/A'} | Reviews: ${tutor.reviews_count} | ` +
              `Status: ${tutor.availability_note}`
            );
            console.log(`✅ Found tutor: ${tutor.name}`);
          } else {
            console.log(`❌ Tutor "${name}" not found in database`);
            dbBlocks.push(`Tutor "${name}" not found in database.`);
          }
        } else {
          console.log(`⚠️  No tutor name extracted from intent`);
        }
        break;
      }

      case 'tutors_by_subject': {
        const subject = intent.slots.subject;
        console.log(`[INTENT] tutors_by_subject, subject: "${subject}"`);
        
        if (subject) {
          const tutors = await listTutorsBySubject(subject, 5);
          console.log(`[DB_ROWS] ${tutors.length} tutors found`);
          
          if (tutors.length > 0) {
            // Format tutors list - explicitly state count
            dbBlocks.push(`Found ${tutors.length} tutor${tutors.length > 1 ? 's' : ''} for "${subject}":`);
            tutors.forEach((tutor, idx) => {
              // Format subjects - handle special characters like C++, C#
              const subs = (tutor.subjects || []).map(s => {
                if (!s || s.length === 0) return s;
                // For subjects with special chars (C++, C#), preserve them
                // For normal subjects, capitalize first letter
                if (/[+#]/.test(s)) {
                  return s; // Keep as-is for C++, C#, etc.
                }
                return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
              }).filter(Boolean).join(', ') || 'N/A';
              
              const price = `${formatPrice(tutor.price_per_hour)}/hr`;
              const rating = tutor.rating || 'N/A';
              const reviews = tutor.reviews_count || 0;
              
              dbBlocks.push(
                `${idx + 1}. Tutor: ${tutor.name} | Subjects: ${subs} | Price: ${price} | Rating: ${rating} | Reviews: ${reviews}`
              );
            });
          } else {
            console.log(`[DB_ROWS] No tutors found for "${subject}"`);
            dbBlocks.push(`I searched the database for tutors with subject "${subject}" but found 0 tutors.`);
          }
        } else {
          // List all tutors
          console.log(`[INTENT] Listing all tutors (no subject specified)`);
          const tutors = await listAllTutors(5);
          console.log(`[DB_ROWS] ${tutors.length} total tutors`);
          
          if (tutors.length > 0) {
            tutors.forEach(tutor => {
              const subs = (tutor.subjects || []).map(s => {
                return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
              }).join(', ') || 'N/A';
              
              const price = `${formatPrice(tutor.price_per_hour)}/hr`;
              
              dbBlocks.push(
                `Tutor: ${tutor.name} | Subjects: ${subs} | Price: ${price} | Reviews: ${tutor.reviews_count || 0}`
              );
            });
          } else {
            console.log(`[DB_ROWS] No tutors found in database`);
            dbBlocks.push('No tutors found in the database.');
          }
        }
        break;
      }

      case 'tutor_rating_by_name': {
        const name = intent.slots.name;
        if (name) {
          const rating = await getTutorRatings(name);
          if (rating) {
            dbBlocks.push(
              `Tutor: ${name} | Reviews: ${rating.reviews_count} | ` +
              `Last review: ${rating.last_review_at ? new Date(rating.last_review_at).toLocaleDateString() : 'N/A'}`
            );
          } else {
            dbBlocks.push(`No rating information found for tutor "${name}".`);
          }
        }
        break;
      }

      case 'pricing_summary': {
        const summary = await getPricingSummary();
        if (summary.tutor_count > 0) {
          dbBlocks.push(
            `Pricing Summary: Min: ${summary.min_price ? `$${summary.min_price}/hr` : 'N/A'} | ` +
            `Max: ${summary.max_price ? `$${summary.max_price}/hr` : 'N/A'} | ` +
            `Average: ${summary.avg_price ? `$${summary.avg_price.toFixed(2)}/hr` : 'N/A'} | ` +
            `Total tutors: ${summary.tutor_count}`
          );
        } else {
          dbBlocks.push('No pricing information available.');
        }
        break;
      }

      case 'policy': {
        const policy = await getPolicy(intent.slots.key);
        if (policy) {
          dbBlocks.push(`Policy (${intent.slots.key}): ${policy}`);
        }
        // If no policy table, RAG will handle it
        break;
      }
    }
  } catch (error) {
    console.error('❌ Error building DB context:', error.message);
    // Continue without DB context
  }

  return dbBlocks.length > 0 ? dbBlocks.join('\n') : '';
}

// POST /api/chat
router.post("/chat", async (req, res) => {
  try {
    const { messages } = req.body;

    // Validate messages array
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array is required and must not be empty" });
    }

    // Validate message structure
    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        return res.status(400).json({ error: "Each message must have 'role' and 'content' fields" });
      }
      if (!["system", "user", "assistant"].includes(msg.role)) {
        return res.status(400).json({ error: "Message role must be 'system', 'user', or 'assistant'" });
      }
    }

    // Extract user query
    const userQuery = extractQuery(messages);
    console.log(`📝 User query: "${userQuery}"`);
    
    // Detect intent
    const intent = detectIntent(userQuery);
    console.log(`🎯 Detected intent: ${intent.type}, slots:`, JSON.stringify(intent.slots));
    
    // Build DB context
    const dbContext = await buildDBContext(intent);
    
    // Build RAG context
    let ragContext = '';
    const index = loadIndex();
    if (index && index.chunks && index.chunks.length > 0 && userQuery && userQuery.length > 10) {
      try {
        const queryEmbedding = await embed(userQuery);
        const topChunks = similaritySearch(queryEmbedding, RAG_TOP_K);
        
        if (topChunks.length > 0) {
          ragContext = buildContext(topChunks);
          console.log(`📚 RAG: Retrieved ${topChunks.length} chunks for query`);
        }
      } catch (ragError) {
        console.error("⚠️  RAG error:", ragError.message);
        // Continue without RAG context
      }
    }

    // Build combined context message
    let contextParts = [];
    if (dbContext && dbContext.trim().length > 0) {
      contextParts.push(`DB:\n${dbContext}`);
      console.log(`💾 DB Context (${dbContext.length} chars): ${dbContext.substring(0, 100)}...`);
    }
    if (ragContext && ragContext.trim().length > 0) {
      contextParts.push(`Docs:\n${ragContext}`);
      console.log(`📚 RAG Context (${ragContext.length} chars): ${ragContext.substring(0, 100)}...`);
    }

    // Prepare messages for LLM
    let messagesToSend = [...messages];

    // If we have any context (DB or RAG), augment the messages
    if (contextParts.length > 0) {
      const combinedContext = contextParts.join('\n\n---\n\n');
      
      messagesToSend = [
        {
          role: "system",
          content: `You are TutorBot. Answer using ONLY the DB and Docs context provided.

ABSOLUTE RULES - NO EXCEPTIONS:
1. NEVER invent, make up, or add any tutor names, prices, ratings, or data that is NOT in the DB context.
2. Count the tutors in the DB context. If DB shows "Found 1 tutor", list ONLY 1 tutor. If DB shows "Found 0 tutors", say you found 0 tutors.
3. Copy the EXACT tutor information from DB context. Do NOT change names, prices, or add details.
4. If DB context says "Found X tutors", list EXACTLY X tutors from the DB context - no more, no less.
5. If DB context shows 0 tutors, reply: "I couldn't find any tutors for [subject] in our database. Try another subject or check spelling."
6. Do NOT use placeholders like "[Tutor Name]" or make up example tutors.
7. Do NOT estimate or calculate prices - use the EXACT price from DB context.
8. Keep answers concise and factual.
9. Format: Use the numbered list format from DB context (1. Tutor: ... 2. Tutor: ...).

The DB context shows the ACTUAL count and data. If it says "Found 1 tutor", there is only 1. Do not add more.`,
        },
        {
          role: "user",
          content: `Context:\n${combinedContext}\n\n---\n\nUser's question: ${userQuery}\n\nIMPORTANT: Use ONLY the tutors listed in the DB context above. Do NOT invent, estimate, or add any tutors. If DB shows 1 tutor, list only 1. If DB shows 0 tutors, say you couldn't find any.`,
        },
        // Include original conversation (skip any existing system messages)
        ...messages.filter(msg => msg.role !== "system"),
      ];

      if (dbContext && dbContext.trim().length > 0) {
        console.log(`💾 DB: Retrieved context for intent: ${intent.type}`);
      }
    } else {
      // No context available - log for debugging
      console.log(`⚠️  No context available. Intent: ${intent.type}, DB: ${dbContext ? 'empty' : 'null'}, RAG: ${ragContext ? 'empty' : 'null'}`);
    }

    // Call LLM service (Ollama)
    const reply = await chat(messagesToSend);

    res.json({ reply });
  } catch (error) {
    console.error("❌ AI chat error:", error.message);
    
    // Provide more specific error messages
    if (error.message.includes("ECONNREFUSED") || error.message.includes("fetch failed")) {
      return res.status(503).json({ error: "AI service unavailable. Please ensure Ollama is running." });
    }
    
    res.status(500).json({ error: "AI service failed" });
  }
});

module.exports = router;
