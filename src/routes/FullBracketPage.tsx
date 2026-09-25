import { Link, useParams } from "react-router-dom";
import BracketView from "../components/BracketView";
import TournamentFormatCard from "../components/TournamentFormatCard";
import type { AppData } from "../types/data";

type Props = {
  data: AppData;
};

export default function FullBracketPage({ data }: Props) {
  const { tournamentId = "" } = useParams();
  const decodedTournamentId = decodeURIComponent(tournamentId);
  const tournament = data.tournaments.find((item) => item.id === decodedTournamentId) ?? null;
  const bracket = data.brackets.find((item) => item.tournamentId === decodedTournamentId) ?? null;

  if (!tournament) {
    return (
      <section className="fullscreen-bracket-page">
        <div className="status error">找不到该比赛</div>
        <Link to="/competitions">返回比赛页</Link>
      </section>
    );
  }

  return (
    <section className="fullscreen-bracket-page">
      <div className="section-heading row">
        <div>
          <h1>{tournament.name}</h1>
          <p>赛程</p>
        </div>
        <Link to={`/competitions?tournament=${encodeURIComponent(tournament.id)}`}>返回比赛页</Link>
      </div>
      <div className="stack">
        <TournamentFormatCard tournamentName={tournament.name} />
        <BracketView bracket={bracket} fullPage />
      </div>
    </section>
  );
}
