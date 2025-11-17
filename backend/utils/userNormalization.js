// backend/utils/userNormalization.js
const normalizeEmail = (value) => {
  if (!value) return "";
  return String(value).trim().toLowerCase();
};

/**
 * Strictly normalize the user type.
 * Only 'student' or 'tutor' are valid.
 * Anything else is rejected.
 */
const normalizeUserType = (value, fallback = null) => {
  if (!value && fallback) value = fallback;
  if (!value) return null;

  const normalized = String(value).trim().toLowerCase();

  if (normalized === "student" || normalized === "tutor") {
    return normalized;
  }

  return null; // force validation errors, never silently convert
};

module.exports = {
  normalizeEmail,
  normalizeUserType,
};
