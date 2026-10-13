const DICEBEAR_BASE = 'https://api.dicebear.com/7.x/avataaars/svg';
// Restrict the generated face to cheerful expressions (the default set includes sad, angry and crying ones)
const HAPPY_OPTIONS = 'mouth=smile,twinkle&eyes=happy,default,wink&eyebrows=default,defaultNatural,raisedExcited';

// An uploaded photo is resized in the browser to a small JPEG before it is sent
const MAX_UPLOAD_LENGTH = 80000;
const UPLOAD_PATTERN = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;

const happyAvatar = (seed) => `${DICEBEAR_BASE}?seed=${encodeURIComponent(seed)}&${HAPPY_OPTIONS}`;

// Accepts a generated avatar or a small uploaded image; nothing else is stored
function isValidAvatar(value) {
  if (typeof value !== 'string') return false;
  if (value.startsWith(`${DICEBEAR_BASE}?`)) return value.length <= 500;
  return value.length <= MAX_UPLOAD_LENGTH && UPLOAD_PATTERN.test(value);
}

module.exports = { happyAvatar, isValidAvatar, HAPPY_OPTIONS };
