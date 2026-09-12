const ALLOWED_TAGS = new Set([
  'H2', 'H3', 'H4', 'P', 'UL', 'OL', 'LI', 'STRONG', 'EM', 'SPAN',
  'BR', 'DIV', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'HR',
]);

// Attributes that are safe to preserve (no event handlers, no src/href injection)
const ALLOWED_ATTRS = new Set(['style', 'class']);

export function sanitizeHtml(value = '') {
  if (typeof window === 'undefined') return '';

  const parsed = new DOMParser().parseFromString(String(value), 'text/html');

  parsed.body.querySelectorAll('*').forEach((element) => {
    if (!ALLOWED_TAGS.has(element.tagName)) {
      // Unwrap disallowed tags but keep their child content
      element.replaceWith(...element.childNodes);
      return;
    }

    // Strip disallowed attributes from allowed tags
    [...element.attributes].forEach((attr) => {
      if (!ALLOWED_ATTRS.has(attr.name)) {
        element.removeAttribute(attr.name);
      }
    });
  });

  return parsed.body.innerHTML;
}