const DANGEROUS_TAGS = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "link",
  "meta",
  "base",
  "form",
  "input",
  "button",
  "select",
  "textarea",
  "video",
  "audio",
  "template",
  "noscript",
]);

const DANGEROUS_SCHEMES = /^\s*(?:javascript|vbscript|data):/i;

export function sanitizeHtml(html: string): string {
  if (typeof DOMParser === "undefined") return html;

  const doc = new DOMParser().parseFromString(html, "text/html");

  const sanitizeNode = (node: Element): void => {
    [...node.children].forEach((child) => {
      if (DANGEROUS_TAGS.has(child.tagName.toLowerCase())) {
        child.remove();
        return;
      }
      [...child.attributes].forEach((attr) => {
        const name = attr.name.toLowerCase();
        if (name.startsWith("on") || name === "style") {
          child.removeAttribute(attr.name);
          return;
        }
        if (
          (name === "href" || name === "src") &&
          DANGEROUS_SCHEMES.test(attr.value.trim())
        ) {
          child.removeAttribute(attr.name);
        }
      });
      sanitizeNode(child);
    });
  };

  sanitizeNode(doc.body);
  return doc.body.innerHTML;
}
