// backend/services/intent.js
// Intent detection for chatbot queries

// Common words to exclude when extracting tutor names or subjects
const excludeWords = new Set([
  'hourly', 'rate', 'price', 'fee', 'fees', 'cost', 'tutor', 'tutors', 'tutor\'s',
  'what', 'is', 'the', 'for', 'of', 'show', 'list', 'find', 'get', 'tell', 'me',
  'python', 'java', 'javascript', 'c++', 'cpp', 'c#', 'math', 'physics', 'chemistry',
  'computer', 'science', 'subject', 'subjects', 'teaching', 'available', 'registered'
]);

/**
 * Extract tutor name from text
 * @param {string} text - User input text
 * @returns {string|null} - Extracted name or null
 */
function extractTutorName(text) {

  // Common patterns: "X's price", "X's rate", "price for X", "rate for X"
  // Priority: possessive patterns first (X's rate)
  // Match: "Mehak's rate" or "John's hourly rate" - capture name before 's
  const possessivePattern = /\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)'s\s+(?:hourly\s+)?(?:rate|price|fee|fees|rating|review|cost)/i;
  const possessiveMatch = text.match(possessivePattern);
  if (possessiveMatch && possessiveMatch[1]) {
    const name = possessiveMatch[1].trim();
    // Split and get last part if it's a multi-word (to avoid "is Mehak")
    const nameParts = name.split(/\s+/);
    const finalName = nameParts.length > 1 && excludeWords.has(nameParts[0].toLowerCase())
      ? nameParts.slice(1).join(' ')
      : name;
    if (!excludeWords.has(finalName.toLowerCase())) {
      return finalName;
    }
  }

  // Pattern: "X rate" or "X price" (but not "What is X" - that's handled by possessive)
  const nameBeforeRate = /\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\s+(?:hourly\s+)?(?:rate|price|fee|fees)(?:\s|$)/i;
  const beforeMatch = text.match(nameBeforeRate);
  if (beforeMatch && beforeMatch[1]) {
    const name = beforeMatch[1].trim();
    // Filter out common words at start
    const nameParts = name.split(/\s+/);
    let startIdx = 0;
    while (startIdx < nameParts.length && excludeWords.has(nameParts[startIdx].toLowerCase())) {
      startIdx++;
    }
    if (startIdx < nameParts.length) {
      const finalName = nameParts.slice(startIdx).join(' ');
      if (finalName.length > 0 && !excludeWords.has(finalName.toLowerCase())) {
        return finalName;
      }
    }
  }

  // Pattern: "rate for X" or "price for X"
  const rateForPattern = /(?:rate|price|fee|fees)\s+(?:for|of)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/i;
  const forMatch = text.match(rateForPattern);
  if (forMatch && forMatch[1]) {
    const name = forMatch[1].trim();
    if (!excludeWords.has(name.toLowerCase())) {
      return name;
    }
  }

  // Pattern: "tutor X" or "X tutor"
  const tutorPattern = /(?:tutor\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)|([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\s+tutor)/i;
  const tutorMatch = text.match(tutorPattern);
  if (tutorMatch) {
    const name = (tutorMatch[1] || tutorMatch[2]).trim();
    if (!excludeWords.has(name.toLowerCase())) {
      return name;
    }
  }

  // Fallback: Find capitalized words that might be names (but exclude common words)
  const words = text.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const word = words[i].replace(/[.,!?'"]/g, '');
    if (word.length > 2 && /^[A-Z][a-z]+$/.test(word) && !excludeWords.has(word.toLowerCase())) {
      // Check if next word is also capitalized (first name + last name)
      if (i + 1 < words.length) {
        const nextWord = words[i + 1].replace(/[.,!?'"]/g, '');
        if (/^[A-Z][a-z]+$/.test(nextWord) && !excludeWords.has(nextWord.toLowerCase())) {
          return `${word} ${nextWord}`;
        }
      }
      return word;
    }
  }

  return null;
}

/**
 * Extract subject from text (case-insensitive, normalized)
 * @param {string} text - User input text
 * @returns {string|null} - Extracted subject or null
 */
function extractSubject(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  const lowerText = text.toLowerCase().trim();
  
  // Common subjects mapping (normalized)
  const subjectMap = {
    'python': 'Python',
    'java': 'Java',
    'javascript': 'JavaScript',
    'js': 'JavaScript',
    'c++': 'C++',
    'cpp': 'C++',
    'c#': 'C#',
    'csharp': 'C#',
    'computer science': 'Computer Science',
    'cs': 'Computer Science',
    'math': 'Mathematics',
    'mathematics': 'Mathematics',
    'physics': 'Physics',
    'chemistry': 'Chemistry',
    'biology': 'Biology',
    'english': 'English',
    'history': 'History',
    'science': 'Science',
    'react': 'React',
    'node': 'Node.js',
    'nodejs': 'Node.js',
    'sql': 'SQL',
    'database': 'Database',
    'algorithms': 'Algorithms',
    'data structures': 'Data Structures',
    'data structure': 'Data Structures',
  };

  // Direct match first (exact or contains)
  for (const [key, value] of Object.entries(subjectMap)) {
    if (lowerText.includes(key)) {
      return value;
    }
  }

  // Try to extract subject after keywords (case-insensitive)
  const patterns = [
    /(?:for|in|teaching|teach|subject|subjects|registered\s+for)\s+([a-zA-Z][a-zA-Z\s]{1,30})/i,
    /([a-zA-Z][a-zA-Z\s]{1,30})\s+(?:tutor|tutors|subject|subjects)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      let potential = match[1].trim();
      // Remove leading "for" if accidentally captured
      potential = potential.replace(/^for\s+/i, '').trim();
      
      // Normalize: capitalize first letter of each word
      const normalized = potential
        .split(/\s+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
      
      if (normalized.length > 1 && normalized.length < 50) {
        // Check if it matches a known subject
        const lowerPotential = normalized.toLowerCase();
        for (const [key, value] of Object.entries(subjectMap)) {
          if (lowerPotential.includes(key) || key.includes(lowerPotential)) {
            return value;
          }
        }
        // Return normalized version if no match
        return normalized;
      }
    }
  }

  return null;
}

/**
 * Detect intent from user text
 * @param {string} userText - User input text
 * @returns {Object} - Intent object with type and slots
 */
function detectIntent(userText) {
  if (!userText || typeof userText !== 'string') {
    return { type: 'freeform', slots: {} };
  }

  const text = userText.trim().toLowerCase();

  // Tutor price by name
  if (
    /(?:what|what's|how much|tell me|show me|get).*(?:price|rate|fee|fees|cost).*(?:for|of|tutor)/.test(text) ||
    /(?:price|rate|fee|fees|cost).*(?:of|for).*(?:tutor|mehak|john|jane|alex)/.test(text) ||
    /(?:tutor|mehak|john|jane|alex).*(?:price|rate|fee|fees|cost)/.test(text)
  ) {
    const name = extractTutorName(userText);
    if (name) {
      return { type: 'tutor_price_by_name', slots: { name } };
    }
  }

  // Tutors by subject - robust patterns for "registered for", "teaching", "who teaches", etc.
  // Pattern 1: "tutors (registered for|for|in|teaching|who teach) <subject>"
  const registeredPattern = /(?:tutors?|tutor'?s?)\s+(?:registered\s+for|for|in|teaching|who\s+teach|who\s+teaches)\s+([a-zA-Z][a-zA-Z\s]{1,30})/i;
  const registeredMatch = text.match(registeredPattern);
  if (registeredMatch && registeredMatch[1]) {
    let potentialSubject = registeredMatch[1].trim();
    // Remove leading "for" if accidentally captured
    potentialSubject = potentialSubject.replace(/^for\s+/i, '').trim();
    const normalizedSubject = extractSubject(potentialSubject) || potentialSubject;
    if (normalizedSubject && normalizedSubject.length > 0 && !excludeWords.has(normalizedSubject.toLowerCase())) {
      return { type: 'tutors_by_subject', slots: { subject: normalizedSubject } };
    }
  }

  // Pattern 2: "<subject> tutors" or "tutors for <subject>"
  // Match "tutors for X" (capture X, not "for X")
  const tutorsForPattern = /tutors?\s+for\s+([a-zA-Z][a-zA-Z\s]{1,30})(?:\s|$)/i;
  const tutorsForMatch = text.match(tutorsForPattern);
  if (tutorsForMatch && tutorsForMatch[1]) {
    let potentialSubject = tutorsForMatch[1].trim();
    potentialSubject = potentialSubject.replace(/^for\s+/i, '').trim();
    const normalizedSubject = extractSubject(potentialSubject) || potentialSubject;
    if (normalizedSubject && normalizedSubject.length > 0 && !excludeWords.has(normalizedSubject.toLowerCase())) {
      return { type: 'tutors_by_subject', slots: { subject: normalizedSubject } };
    }
  }
  
  // Match "<subject> tutors"
  const subjectTutorsPattern = /(?:^|\s)([a-zA-Z][a-zA-Z\s]{1,30})\s+tutors?/i;
  const subjectTutorsMatch = text.match(subjectTutorsPattern);
  if (subjectTutorsMatch && subjectTutorsMatch[1]) {
    let potentialSubject = subjectTutorsMatch[1].trim();
    potentialSubject = potentialSubject.replace(/^for\s+/i, '').trim();
    const normalizedSubject = extractSubject(potentialSubject) || potentialSubject;
    if (normalizedSubject && normalizedSubject.length > 0 && !excludeWords.has(normalizedSubject.toLowerCase())) {
      return { type: 'tutors_by_subject', slots: { subject: normalizedSubject } };
    }
  }

  // Pattern 3: "who teaches <subject>"
  const whoTeachesPattern = /who\s+(?:teaches?|teach)\s+([a-zA-Z][a-zA-Z\s]{1,30})/i;
  const whoTeachesMatch = text.match(whoTeachesPattern);
  if (whoTeachesMatch && whoTeachesMatch[1]) {
    let potentialSubject = whoTeachesMatch[1].trim();
    // Remove leading "for" if accidentally captured
    potentialSubject = potentialSubject.replace(/^for\s+/i, '').trim();
    const normalizedSubject = extractSubject(potentialSubject) || potentialSubject;
    if (normalizedSubject && normalizedSubject.length > 0 && !excludeWords.has(normalizedSubject.toLowerCase())) {
      return { type: 'tutors_by_subject', slots: { subject: normalizedSubject } };
    }
  }

  // Pattern 4: General subject detection with tutor keywords
  // Extract subject from the full text (not just patterns)
  const subject = extractSubject(userText);
  if (
    subject ||
    /(?:find|search|show|list|available|get|need|want|looking\s+for|tell\s+me|can\s+you\s+tell\s+me).*(?:tutor|tutors)/.test(text) ||
    /(?:tutor|tutors).*(?:for|in|subject|teaching|available|under|below|less\s+than|registered)/.test(text)
  ) {
    if (subject) {
      // Clean subject - remove "for" prefix if present
      const cleanSubject = subject.replace(/^for\s+/i, '').trim();
      if (cleanSubject && cleanSubject.length > 0 && !excludeWords.has(cleanSubject.toLowerCase())) {
        return { type: 'tutors_by_subject', slots: { subject: cleanSubject } };
      }
    }
    // Even without subject, user might want tutor list
    return { type: 'tutors_by_subject', slots: { subject: null } };
  }

  // Tutor rating/reviews by name
  if (
    /(?:rating|reviews|review|feedback|rating of|reviews of).*(?:tutor|mehak|john|jane|alex)/.test(text) ||
    /(?:tutor|mehak|john|jane|alex).*(?:rating|reviews|review|feedback)/.test(text) ||
    /(?:how|what).*(?:rating|reviews).*(?:of|for)/.test(text)
  ) {
    const name = extractTutorName(userText);
    if (name) {
      return { type: 'tutor_rating_by_name', slots: { name } };
    }
  }

  // Pricing summary
  if (
    /(?:what|how much|tell me|show me).*(?:price|pricing|cost|fees|rates).*(?:tutor|tutors|platform|service)/.test(text) ||
    /(?:price|pricing|cost|fees|rates).*(?:tutor|tutors|platform|service|general|average)/.test(text) ||
    /(?:average|typical|usual|normal).*(?:price|cost|fee|rate)/.test(text) ||
    text.match(/^(?:price|pricing|cost|fees|rates|how much)$/i)
  ) {
    return { type: 'pricing_summary', slots: {} };
  }

  // Policy queries
  const policyKeywords = {
    login: /(?:login|sign in|signin|log in|account access|password reset|forgot password)/i,
    payment: /(?:payment|pay|billing|charge|invoice|transaction|checkout)/i,
    refund: /(?:refund|return|money back|cancel.*payment)/i,
    booking: /(?:book|booking|schedule|reservation|appointment)/i,
    cancel: /(?:cancel|cancellation|terminate.*session)/i,
    reschedule: /(?:reschedule|change.*time|move.*session|postpone)/i,
  };

  for (const [key, pattern] of Object.entries(policyKeywords)) {
    if (pattern.test(userText)) {
      return { type: 'policy', slots: { key } };
    }
  }

  // Default: freeform query
  return { type: 'freeform', slots: {} };
}

module.exports = { detectIntent };

