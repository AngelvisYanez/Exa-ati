/** Convierte viñetas "• " / "- " separadas por <br> en <ul><li> y limpia saltos. */
export function normalizeChatHtml(html: string): string {
  if (!html) return '';

  const lines = html.split(/<br\s*\/?\s*>/i);
  const out: string[] = [];
  let listBuf: string[] = [];

  const flushList = () => {
    if (listBuf.length === 0) return;
    out.push(`<ul>${listBuf.map((item) => `<li>${item}</li>`).join('')}</ul>`);
    listBuf = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      continue;
    }
    const bullet = line.match(/^[•·\-]\s+(.+)$/);
    if (bullet) {
      listBuf.push(bullet[1].trim());
      continue;
    }
    flushList();
    out.push(line);
  }
  flushList();

  return out
    .join('<br/>')
    .replace(/<br\/>(<ul>)/gi, '$1')
    .replace(/(<\/ul>)<br\/>/gi, '$1')
    .replace(/(?:<br\/>){2,}/gi, '<br/><br/>');
}
