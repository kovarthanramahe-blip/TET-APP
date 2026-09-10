import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './markdown.js';

describe('renderMarkdown', () => {
  it('escapes HTML special characters so note content can never inject markup', () => {
    expect(renderMarkdown('<script>alert(1)</script>')).not.toContain('<script>');
    expect(renderMarkdown('a < b & c > d')).toContain('a &lt; b &amp; c &gt; d');
  });

  it('renders #, ##, ### as h2/h3/h4 headings', () => {
    expect(renderMarkdown('# Big')).toContain('<h2');
    expect(renderMarkdown('## Medium')).toContain('<h3');
    expect(renderMarkdown('### Small')).toContain('<h4');
  });

  it('renders bold, italic, and inline code', () => {
    expect(renderMarkdown('**bold**')).toContain('<strong>bold</strong>');
    expect(renderMarkdown('*italic*')).toContain('<em>italic</em>');
    expect(renderMarkdown('`code`')).toContain('<code');
  });

  it('renders a blockquote for lines starting with ">"', () => {
    expect(renderMarkdown('> a quote')).toContain('<blockquote');
  });

  it('groups consecutive "- " lines into a single <ul>, closing it on the next non-list line', () => {
    const html = renderMarkdown('- one\n- two\nplain text');
    expect(html.match(/<ul/g)).toHaveLength(1);
    expect(html.match(/<li/g)).toHaveLength(2);
    expect(html).toContain('<p');
  });

  it('flushes a trailing list even with no following line', () => {
    const html = renderMarkdown('- only item');
    expect(html).toContain('<ul');
    expect(html).toContain('<li');
  });

  it('wraps a plain line of text in a paragraph', () => {
    expect(renderMarkdown('just text')).toContain('<p style');
  });
});
