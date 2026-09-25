import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import MatchTable from "../components/MatchTable";
import SeriesList from "../components/SeriesList";
import type { AppData } from "../types/data";

type Props = {
  data: AppData;
};

export default function CompetitionPage({ data }: Props) {
  const [searchParams] = useSearchParams();
  const [openTournamentId, setOpenTournamentId] = useState<string | null>(data.tournaments[0]?.id ?? null);
  const [openStageId, setOpenStageId] = useState<string | null>(null);
  const [openSeriesId, setOpenSeriesId] = useState<string | null>(null);

  const stagesByTournament = useMemo(() => {
    return data.stages.reduce<Record<string, typeof data.stages>>((groups, stage) => {
      groups[stage.tournamentId] ??= [];
      groups[stage.tournamentId].push(stage);
      return groups;
    }, {});
  }, [data.stages]);

  const matchesByStage = useMemo(() => {
    return data.matches.reduce<Record<string, typeof data.matches>>((groups, match) => {
      groups[match.stageId] ??= [];
      groups[match.stageId].push(match);
      return groups;
    }, {});
  }, [data.matches]);

  const seriesByStage = useMemo(() => {
    return data.series.reduce<Record<string, typeof data.series>>((groups, item) => {
      groups[item.stageId] ??= [];
      groups[item.stageId].push(item);
      return groups;
    }, {});
  }, [data.series]);

  const selectedStage = useMemo(
    () => data.stages.find((stage) => stage.id === openStageId) ?? null,
    [data.stages, openStageId]
  );
  const selectedTournament = useMemo(() => data.tournaments.find((tournament) => tournament.id === openTournamentId) ?? null, [data.tournaments, openTournamentId]);
  const selectedStageSeries = openStageId ? seriesByStage[openStageId] ?? [] : [];
  const selectedStageMatches = openStageId ? matchesByStage[openStageId] ?? [] : [];

  useEffect(() => {
    const tournamentId = searchParams.get("tournament");
    const stageName = searchParams.get("stage");
    const seriesId = searchParams.get("series");
    if (!tournamentId) return;

    setOpenTournamentId(tournamentId);
    setOpenSeriesId(seriesId);

    if (stageName) {
      const stage = data.stages.find((item) => item.tournamentId === tournamentId && item.name === stageName);
      setOpenStageId(stage?.id ?? null);
    }
  }, [data.stages, searchParams]);

  return (
    <section className="page-grid">
      <aside className="panel">
        <h2>比赛</h2>
        <div className="tree">
          {data.tournaments.map((tournament) => {
            const stages = stagesByTournament[tournament.id] ?? [];
            const isOpen = openTournamentId === tournament.id;
            return (
              <div key={tournament.id} className="tree-group">
                <button
                  type="button"
                  className="tree-button strong"
                  onClick={() => {
                    setOpenTournamentId(isOpen ? null : tournament.id);
                    setOpenStageId(null);
                    setOpenSeriesId(null);
                  }}
                >
                  {tournament.name}
                  <span>{stages.length}</span>
                </button>
                {isOpen && (
                  <div className="tree-children">
                    {stages.map((stage) => (
                      <button
                        key={stage.id}
                        type="button"
                        className={openStageId === stage.id ? "tree-button active" : "tree-button"}
                        onClick={() => {
                          setOpenStageId(stage.id);
                          setOpenSeriesId(null);
                        }}
                      >
                        {stage.name}
                        <span>{seriesByStage[stage.id]?.length || matchesByStage[stage.id]?.length || 0}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>
      <section className="content-panel">
        <div className="section-heading row">
          <div>
            <h2>{selectedStage?.name ?? "选择赛段"}</h2>
            <p>
              {openStageId
                ? selectedStageSeries.length > 0
                  ? `${selectedStageSeries.length} 场系列赛 / ${selectedStageMatches.length} 局`
                  : `${selectedStageMatches.length} 场对局`
                : "点击左侧赛段查看对局"}
            </p>
          </div>
          <div className="view-tabs" aria-label="比赛页面视图">
            <button type="button" className="active">
              对局列表
            </button>
            <button
              type="button"
              onClick={() => {
                if (!selectedTournament) return;
                window.open(
                  `${window.location.origin}${window.location.pathname}#/brackets/${encodeURIComponent(selectedTournament.id)}`,
                  "_blank",
                  "noopener,noreferrer"
                );
              }}
              disabled={!selectedTournament}
            >
              赛程
            </button>
          </div>
        </div>
        {selectedStageSeries.length > 0 ? (
          <SeriesList series={selectedStageSeries} matches={data.matches} initialOpenSeriesId={openSeriesId} />
        ) : (
          <MatchTable matches={selectedStageMatches} />
        )}
      </section>
    </section>
  );
}
