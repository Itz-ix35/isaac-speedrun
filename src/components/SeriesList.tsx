import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import MatchTable from "./MatchTable";
import type { Match, Series } from "../types/data";

type Props = {
  series: Series[];
  matches: Match[];
  initialOpenSeriesId?: string | null;
};

export default function SeriesList({ series, matches, initialOpenSeriesId }: Props) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const matchesById = useMemo(() => new Map(matches.map((match) => [match.id, match])), [matches]);

  useEffect(() => {
    if (!initialOpenSeriesId) return;
    setOpenIds((current) => new Set(current).add(initialOpenSeriesId));
  }, [initialOpenSeriesId]);

  if (series.length === 0) {
    return <div className="empty">没有可展示的系列赛</div>;
  }

  const toggle = (id: string) => {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="series-list">
      {series.map((item) => {
        const isOpen = openIds.has(item.id);
        const itemMatches = item.matchIds.map((id) => matchesById.get(id)).filter((match): match is Match => Boolean(match));
        return (
          <article key={item.id} id={`series-${item.id}`} className="series-item">
            <button type="button" className="series-summary" onClick={() => toggle(item.id)}>
              {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              <span className="series-players">
                {item.playerAName} vs {item.playerBName}
              </span>
              <span className="series-score">
                {item.playerAWins}:{item.playerBWins}
              </span>
              <span className="series-meta">{item.format}</span>
              <span className="series-winner">胜者：{item.winnerName}</span>
            </button>
            {item.warnings.length > 0 && (
              <div className="warning-line">{item.warnings.join("；")}</div>
            )}
            {isOpen && <MatchTable matches={itemMatches} />}
          </article>
        );
      })}
    </div>
  );
}
