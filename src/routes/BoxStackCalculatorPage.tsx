import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import PlayerIdInput from "../components/PlayerIdInput";
import type { AppData, Match, Player } from "../types/data";

type Props = {
  data: AppData;
};

type AdvantageEdge = {
  fromId: string;
  toId: string;
  fromWins: number;
  toWins: number;
};

type SearchResult =
  | { status: "idle" }
  | { status: "missing"; playerAInput: string; playerBInput: string; playerA?: Player; playerB?: Player }
  | { status: "found"; chain: string[]; edges: AdvantageEdge[] }
  | { status: "not-found"; playerA: Player; playerB: Player };

const findPlayer = (data: AppData, value: string) => {
  const normalized = value.trim();
  const normalizedLower = normalized.toLowerCase();
  return normalized
    ? data.players.find(
        (player) => player.id === normalized || player.displayName === normalized || player.displayName.toLowerCase() === normalizedLower
      )
    : undefined;
};

const pairKey = (playerAId: string, playerBId: string) => [playerAId, playerBId].sort().join("\u0000");

const getPairCounts = (matches: Match[]) => {
  const counts = new Map<string, Map<string, number>>();
  for (const match of matches) {
    const key = pairKey(match.winnerPlayerId, match.loserPlayerId);
    const pairCounts = counts.get(key) ?? new Map<string, number>();
    pairCounts.set(match.winnerPlayerId, (pairCounts.get(match.winnerPlayerId) ?? 0) + 1);
    counts.set(key, pairCounts);
  }
  return counts;
};

const buildAdvantageGraph = (matches: Match[]) => {
  const graph = new Map<string, AdvantageEdge[]>();
  const pairCounts = getPairCounts(matches);

  for (const [key, counts] of pairCounts) {
    const [playerAId, playerBId] = key.split("\u0000");
    const playerAWins = counts.get(playerAId) ?? 0;
    const playerBWins = counts.get(playerBId) ?? 0;
    if (playerAWins === playerBWins) continue;

    const edge =
      playerAWins > playerBWins
        ? { fromId: playerAId, toId: playerBId, fromWins: playerAWins, toWins: playerBWins }
        : { fromId: playerBId, toId: playerAId, fromWins: playerBWins, toWins: playerAWins };
    const edges = graph.get(edge.fromId) ?? [];
    edges.push(edge);
    graph.set(edge.fromId, edges);
  }

  return graph;
};

const findAdvantageChain = (graph: Map<string, AdvantageEdge[]>, startId: string, endId: string) => {
  if (startId === endId) return { chain: [startId], edges: [] };

  const visited = new Set([startId]);
  const queue = [startId];
  const previous = new Map<string, { playerId: string; edge: AdvantageEdge }>();

  for (let index = 0; index < queue.length; index += 1) {
    const currentId = queue[index];
    for (const edge of graph.get(currentId) ?? []) {
      if (visited.has(edge.toId)) continue;
      visited.add(edge.toId);
      previous.set(edge.toId, { playerId: currentId, edge });
      if (edge.toId === endId) {
        const chain = [endId];
        const edges: AdvantageEdge[] = [];
        let cursor = endId;
        while (cursor !== startId) {
          const item = previous.get(cursor);
          if (!item) break;
          edges.unshift(item.edge);
          chain.unshift(item.playerId);
          cursor = item.playerId;
        }
        return { chain, edges };
      }
      queue.push(edge.toId);
    }
  }

  return null;
};

export default function BoxStackCalculatorPage({ data }: Props) {
  const [playerAInput, setPlayerAInput] = useState("");
  const [playerBInput, setPlayerBInput] = useState("");
  const [result, setResult] = useState<SearchResult>({ status: "idle" });
  const playerById = useMemo(() => new Map(data.players.map((player) => [player.id, player])), [data.players]);
  const graph = useMemo(() => buildAdvantageGraph([...data.matches, ...data.arenaMatches]), [data.arenaMatches, data.matches]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const playerA = findPlayer(data, playerAInput);
    const playerB = findPlayer(data, playerBInput);

    if (!playerA || !playerB) {
      setResult({ status: "missing", playerAInput: playerAInput.trim(), playerBInput: playerBInput.trim(), playerA, playerB });
      return;
    }

    const chain = findAdvantageChain(graph, playerA.id, playerB.id);
    setResult(chain ? { status: "found", ...chain } : { status: "not-found", playerA, playerB });
  };

  const swapPlayers = () => {
    setPlayerAInput(playerBInput);
    setPlayerBInput(playerAInput);
  };

  const getPlayerName = (playerId: string) => playerById.get(playerId)?.displayName ?? playerId;

  return (
    <section className="stack">
      <div className="section-heading">
        <h2>叠盒子计算器</h2>
        <p>输入两个选手 id，寻找一条从 A 到 B 的“优”链</p>
      </div>

      <form className="compare-form box-stack-form" onSubmit={handleSubmit}>
        <PlayerIdInput label="选手 A id" players={data.players} value={playerAInput} onChange={setPlayerAInput} />
        <button type="button" className="swap-button" onClick={swapPlayers} aria-label="交换选手 A 和 B">
          ⇄
        </button>
        <PlayerIdInput label="选手 B id" players={data.players} value={playerBInput} onChange={setPlayerBInput} />
        <button type="submit">确认</button>
      </form>

      {result.status === "missing" && (
        <div className="status error">
          {!result.playerA && <p>找不到选手：{result.playerAInput || "空"}</p>}
          {!result.playerB && <p>找不到选手：{result.playerBInput || "空"}</p>}
        </div>
      )}

      {result.status === "not-found" && (
        <div className="empty">
          不存在从 {result.playerA.displayName} 到 {result.playerB.displayName} 的优链
        </div>
      )}

      {result.status === "found" && (
        <div className="chain-result">
          <div className="section-heading">
            <h2>计算结果</h2>
            <p>{result.chain.map(getPlayerName).join(" → ")}</p>
          </div>
          <ol className="chain-steps">
            {result.edges.map((edge) => (
              <li key={`${edge.fromId}-${edge.toId}`}>
                <strong>{getPlayerName(edge.fromId)}</strong>
                <span>
                  {edge.fromWins}:{edge.toWins} 优
                </span>
                <strong>{getPlayerName(edge.toId)}</strong>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
