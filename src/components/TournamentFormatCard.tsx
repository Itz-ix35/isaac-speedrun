import ReactMarkdown from "react-markdown";
import tournamentText from "../../tournament.txt?raw";

type Props = {
  tournamentName?: string;
};

type TournamentFormat = {
  text: string;
  terms: string[];
};

const parseTournamentText = () => {
  const lines = tournamentText.replace(/\r\n/g, "\n").split("\n");
  const formats = new Map<string, TournamentFormat>();
  const definitions = new Map<string, string>();
  const knownTerms = new Set<string>();
  let index = 0;

  for (; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) break;
    const separatorIndex = line.indexOf(",");
    if (separatorIndex === -1) continue;

    const tournamentName = line.slice(0, separatorIndex).trim();
    const text = line.slice(separatorIndex + 1).trim();
    const terms = Array.from(text.matchAll(/【([^】]+)】/g), (match) => match[1].trim()).filter(Boolean);
    for (const term of terms) {
      knownTerms.add(term);
    }
    formats.set(tournamentName, { text, terms });
  }

  let currentTerm = "";
  let currentLines: string[] = [];
  const flushDefinition = () => {
    if (!currentTerm) return;
    definitions.set(currentTerm, currentLines.join("\n").trim());
    currentTerm = "";
    currentLines = [];
  };

  for (; index < lines.length; index += 1) {
    const line = lines[index];
    const heading = line.trim().match(/^(.+)：$/);
    const headingTerm = heading?.[1].trim();
    if (headingTerm && knownTerms.has(headingTerm) && !line.startsWith(" ") && !line.startsWith("\t")) {
      flushDefinition();
      currentTerm = headingTerm;
      continue;
    }
    if (!currentTerm && !line.trim()) continue;
    currentLines.push(line);
  }
  flushDefinition();

  return { formats, definitions };
};

const { formats, definitions } = parseTournamentText();

const renderFormatText = (text: string) => {
  const parts = text.split(/(【[^】]+】)/g);
  return parts.map((part, index) => {
    const term = part.match(/^【([^】]+)】$/)?.[1];
    if (!term) return <span key={`${index}-${part}`}>{part}</span>;
    return (
      <span className="format-term-highlight" key={`${index}-${part}`}>
        {part}
      </span>
    );
  });
};

export default function TournamentFormatCard({ tournamentName }: Props) {
  const format = tournamentName ? formats.get(tournamentName) : null;

  return (
    <section className="format-card">
      <h3>赛制</h3>
      {format ? (
        <>
          <p className="format-summary">{renderFormatText(format.text)}</p>
          {format.terms.length > 0 && (
            <div className="format-definitions">
              {Array.from(new Set(format.terms)).map((term) => {
                const definition = definitions.get(term);
                if (!definition) return null;
                return (
                  <section className="format-definition" key={term}>
                    <h4>{term}</h4>
                    <ReactMarkdown>{definition}</ReactMarkdown>
                  </section>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <p className="format-summary muted">暂无赛制记录</p>
      )}
    </section>
  );
}
