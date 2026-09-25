import ReactMarkdown from "react-markdown";

type Props = {
  title: string;
  content: string;
};

export default function MarkdownPage({ title, content }: Props) {
  return (
    <section className="markdown-page content-panel">
      <div className="section-heading">
        <h2>{title}</h2>
      </div>
      <div className="markdown-content">
        <ReactMarkdown
          components={{
            a: ({ children, href }) => (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            )
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </section>
  );
}
