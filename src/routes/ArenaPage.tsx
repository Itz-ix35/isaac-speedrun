import { useMemo, useState } from "react";
import MatchTable from "../components/MatchTable";
import type { AppData } from "../types/data";

type Props = {
  data: AppData;
};

export default function ArenaPage({ data }: Props) {
  const dates = useMemo(() => {
    return Array.from(new Set(data.arenaMatches.map((match) => match.date))).sort((a, b) => b.localeCompare(a));
  }, [data.arenaMatches]);
  const [openDate, setOpenDate] = useState<string | null>(dates[0] ?? null);

  const matchesByDate = useMemo(() => {
    return data.arenaMatches.reduce<Record<string, typeof data.arenaMatches>>((groups, match) => {
      groups[match.date] ??= [];
      groups[match.date].push(match);
      return groups;
    }, {});
  }, [data.arenaMatches]);

  const selectedMatches = openDate ? matchesByDate[openDate] ?? [] : [];

  return (
    <section className="page-grid">
      <aside className="panel">
        <h2>擂台日期</h2>
        <div className="tree">
          {dates.map((date) => (
            <button
              key={date}
              type="button"
              className={openDate === date ? "tree-button active" : "tree-button"}
              onClick={() => setOpenDate(date)}
            >
              {date}
              <span>{matchesByDate[date]?.length ?? 0}</span>
            </button>
          ))}
        </div>
      </aside>
      <section className="content-panel">
        <div className="section-heading">
          <h2>{openDate ?? "选择日期"}</h2>
          <p>{openDate ? `${selectedMatches.length} 场常规擂台对局` : "点击左侧日期查看对局"}</p>
        </div>
        <MatchTable matches={selectedMatches} />
      </section>
    </section>
  );
}
