// backend/utils/userNormalization.js
// Shared helpers for normalizing user identity fields

const normalizeEmail = (value) => {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).trim().toLowerCase();
};

const normalizeUserType = (value, fallback = "student") => {
  const source = value ?? fallback ?? "";
  if (source === undefined || source === null) {
    return "";
  }
  return String(source).trim().toLowerCase();
};

module.exports = {
  normalizeEmail,
  normalizeUserType,
};
