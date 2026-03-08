import { Fragment, ReactNode } from 'react';

const renderInlineMarkdown = (text: string): ReactNode => {
  const parts: ReactNode[] = [];
  const inlinePattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = null;
  let key = 0;

  while ((match = inlinePattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<Fragment key={`txt-${key++}`}>{text.slice(lastIndex, match.index)}</Fragment>);
    }

    const token = match[0];
    if (token.startsWith('**')) {
      parts.push(<strong key={`b-${key++}`}>{token.slice(2, -2)}</strong>);
    } else {
      parts.push(
        <code
          key={`c-${key++}`}
          style={{
            fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            backgroundColor: 'rgba(255,255,255,0.07)',
            borderRadius: '4px',
            padding: '0.05rem 0.3rem',
            fontSize: '0.82em',
          }}
        >
          {token.slice(1, -1)}
        </code>
      );
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(<Fragment key={`tail-${key++}`}>{text.slice(lastIndex)}</Fragment>);
  }

  return parts;
};

export const renderMarkdownBlocks = (markdown: string, maxBlocks?: number): ReactNode[] => {
  const lines = markdown.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (!line) {
      i += 1;
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
    if (headingMatch) {
      const headingLevel = Math.min(6, headingMatch[1].length);
      const headingText = headingMatch[2];
      const fontSize = headingLevel <= 2 ? '1rem' : '0.875rem';
      blocks.push(
        <div key={`h-${key++}`} style={{ fontSize, fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.4rem' }}>
          {renderInlineMarkdown(headingText)}
        </div>
      );
      i += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${key++}`} style={{ margin: 0, paddingLeft: '1.1rem', color: 'var(--text-secondary)' }}>
          {items.map((item, idx) => (
            <li key={`uli-${idx}`} style={{ marginBottom: '0.35rem', lineHeight: 1.5 }}>
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ol key={`ol-${key++}`} style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-secondary)' }}>
          {items.map((item, idx) => (
            <li key={`oli-${idx}`} style={{ marginBottom: '0.35rem', lineHeight: 1.5 }}>
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    const paragraphLines: string[] = [];
    while (i < lines.length) {
      const probe = lines[i].trim();
      if (!probe || /^(#{1,6})\s+/.test(probe) || /^[-*]\s+/.test(probe) || /^\d+\.\s+/.test(probe)) {
        break;
      }
      paragraphLines.push(probe);
      i += 1;
    }

    blocks.push(
      <p key={`p-${key++}`} style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        {renderInlineMarkdown(paragraphLines.join(' '))}
      </p>
    );
  }

  const visibleBlocks = typeof maxBlocks === 'number' ? blocks.slice(0, maxBlocks) : blocks;
  if (visibleBlocks.length > 0) {
    return visibleBlocks;
  }

  return [
    <p key="empty" style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
      No diagnosis summary available.
    </p>,
  ];
};
