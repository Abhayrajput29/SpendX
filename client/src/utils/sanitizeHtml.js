const allowedTags = new Set(['H4', 'P', 'UL', 'OL', 'LI', 'STRONG', 'EM', 'SPAN', 'BR', 'DIV']);

export function sanitizeHtml(value = '') {
  if (typeof window === 'undefined') return '';
  const parsed = new DOMParser().parseFromString(String(value), 'text/html');
  parsed.body.querySelectorAll('*').forEach((element) => {
    if (!allowedTags.has(element.tagName)) {
      element.replaceWith(...element.childNodes);
      return;
    }
    [...element.attributes].forEach((attribute) => element.removeAttribute(attribute.name));
  });
  return parsed.body.innerHTML;
}