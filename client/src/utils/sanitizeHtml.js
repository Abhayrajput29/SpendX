const ALLOWED_TAGS = new Set([
  'H2', 'H3', 'H4', 'P', 'UL', 'OL', 'LI', 'STRONG', 'EM', 'SPAN',
  'BR', 'DIV', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'HR',
]);

export function sanitizeHtml(value = '') {
  if (typeof window === 'undefined') return '';

  const parsed = new DOMParser().parseFromString(String(value), 'text/html');

  parsed.body.querySelectorAll('*').forEach((element) => {
    if (!ALLOWED_TAGS.has(element.tagName)) {
      // Unwrap disallowed tags but keep their child content
      element.replaceWith(...element.childNodes);
      return;
    }

    // AI output is untrusted: remove all attributes, including style and class.
    [...element.attributes].forEach((attr) => element.removeAttribute(attr.name));
  });

  return parsed.body.innerHTML;
}
