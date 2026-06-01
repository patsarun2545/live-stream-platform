/**
 * Input sanitization utilities
 * Uses built-in string methods only - no external dependencies
 */

/**
 * Sanitize text by trimming whitespace and escaping HTML entities
 * @param {string} str - Input string
 * @returns {string} - Sanitized string
 */
function sanitizeText(str) {
  if (typeof str !== "string") return "";
  
  // Trim whitespace
  let cleaned = str.trim();
  
  // Escape HTML entities
  const escapeMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
    "/": "&#x2F;",
  };
  
  return cleaned.replace(/[&<>"'/]/g, (char) => escapeMap[char] || char);
}

/**
 * Sanitize tags array
 * - Filter to strings only
 * - Sanitize each tag
 * - Convert to lowercase
 * - Remove duplicates
 * - Limit to max 10 tags
 * @param {Array} arr - Input array
 * @returns {Array} - Sanitized tags array
 */
function sanitizeTags(arr) {
  if (!Array.isArray(arr)) return [];
  
  // Filter to strings only and sanitize each
  const sanitized = arr
    .filter((item) => typeof item === "string")
    .map((tag) => sanitizeText(tag).toLowerCase())
    .filter((tag) => tag.length > 0);
  
  // Remove duplicates using Set
  const unique = [...new Set(sanitized)];
  
  // Limit to max 10 tags
  return unique.slice(0, 10);
}

/**
 * Sanitize username
 * - Trim whitespace
 * - Allow only a-z, A-Z, 0-9, _, -
 * - Remove other characters
 * @param {string} str - Input string
 * @returns {string} - Sanitized username
 */
function sanitizeUsername(str) {
  if (typeof str !== "string") return "";
  
  // Trim whitespace
  let cleaned = str.trim();
  
  // Allow only a-z, A-Z, 0-9, _, -
  // Replace other characters with empty string
  cleaned = cleaned.replace(/[^a-zA-Z0-9_-]/g, "");
  
  return cleaned;
}

module.exports = {
  sanitizeText,
  sanitizeTags,
  sanitizeUsername,
};
