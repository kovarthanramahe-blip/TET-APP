export function renderMarkdown(src) {
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (t) => esc(t)
    .replace(/`([^`]+)`/g, '<code style="font-family:ui-monospace,monospace;font-size:.9em;background:var(--color-surface);padding:1px 4px;border-radius:2px">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  const out = [];
  let list = null;
  (src || '').split('\n').forEach(line => {
    const flush = () => { if (list) { out.push('<ul style="margin:0 0 10px;padding-left:18px">' + list.join('') + '</ul>'); list = null; } };
    if (/^\s*[-*]\s+/.test(line)) { list = list || []; list.push('<li style="margin-bottom:3px">' + inline(line.replace(/^\s*[-*]\s+/, '')) + '</li>'); return; }
    flush();
    if (/^###\s+/.test(line)) out.push('<h4 style="margin:12px 0 4px">' + inline(line.slice(4)) + '</h4>');
    else if (/^##\s+/.test(line)) out.push('<h3 style="margin:14px 0 4px">' + inline(line.slice(3)) + '</h3>');
    else if (/^#\s+/.test(line)) out.push('<h2 style="margin:0 0 8px">' + inline(line.slice(2)) + '</h2>');
    else if (/^>\s+/.test(line)) out.push('<blockquote style="margin:8px 0;padding-left:12px;border-left:2px solid var(--color-accent);font-style:italic">' + inline(line.slice(2)) + '</blockquote>');
    else if (line.trim() === '') out.push('');
    else out.push('<p style="margin:0 0 10px">' + inline(line) + '</p>');
  });
  if (list) out.push('<ul style="margin:0 0 10px;padding-left:18px">' + list.join('') + '</ul>');
  return out.join('');
}
