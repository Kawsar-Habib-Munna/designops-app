// Shows text written in a RichTextField (the **bold** / *italic* / ## heading / - bullet / 1. numbered subset).
// Plain text written before the toolbar existed renders the same as before. Safe: React elements only, no innerHTML.
import SowRichText from './SowRichText';

export default function RichText({ text, className }: { text: string | null | undefined; className?: string }) {
  if (!text) return null;
  return <SowRichText text={text} className={`rt${className ? ` ${className}` : ''}`} />;
}
