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
  totalMatches: number;
};

type SearchResult =
  | { status: "idle" }
  | { status: "missing"; playerAInput: string; playerBInput: string; playerA?: Player; playerB?: Player }
  | { status: "found"; chain: string[]; edges: AdvantageEdge[]; bottleneckMatches: number }
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
    const totalMatches = playerAWins + playerBWins;

    const edge =
      playerAWins > playerBWins
        ? { fromId: playerAId, toId: playerBId, fromWins: playerAWins, toWins: playerBWins, totalMatches }
        : { fromId: playerBId, toId: playerAId, fromWins: playerBWins, toWins: playerAWins, totalMatches };
    const edges = graph.get(edge.fromId) ?? [];
    edges.push(edge);
    graph.set(edge.fromId, edges);
  }

  for (const edges of graph.values()) {
    edges.sort((a, b) => b.totalMatches - a.totalMatches || b.fromWins - a.fromWins || a.toId.localeCompare(b.toId));
  }

  return graph;
};

const findAdvantageChain = (graph: Map<string, AdvantageEdge[]>, startId: string, endId: string) => {
  if (startId === endId) return { chain: [startId], edges: [], bottleneckMatches: Infinity };

  const bestBottleneck = new Map<string, number>([[startId, Infinity]]);
  const bestHops = new Map<string, number>([[startId, 0]]);
  const previous = new Map<string, { playerId: string; edge: AdvantageEdge }>();
  const unsettled = new Set<string>([startId]);

  while (unsettled.size > 0) {
    const currentId = Array.from(unsettled).sort((a, b) => {
      const bottleneckDiff = (bestBottleneck.get(b) ?? 0) - (bestBottleneck.get(a) ?? 0);
      if (bottleneckDiff !== 0) return bottleneckDiff;
      return (bestHops.get(a) ?? Infinity) - (bestHops.get(b) ?? Infinity);
    })[0];
    unsettled.delete(currentId);
    if (currentId === endId) break;

    const currentBottleneck = bestBottleneck.get(currentId) ?? 0;
    const currentHops = bestHops.get(currentId) ?? 0;
    for (const edge of graph.get(currentId) ?? []) {
      const nextBottleneck = Math.min(currentBottleneck, edge.totalMatches);
      const existingBottleneck = bestBottleneck.get(edge.toId) ?? 0;
      const nextHops = currentHops + 1;
      const existingHops = bestHops.get(edge.toId) ?? Infinity;
      if (nextBottleneck > existingBottleneck || (nextBottleneck === existingBottleneck && nextHops < existingHops)) {
        bestBottleneck.set(edge.toId, nextBottleneck);
        bestHops.set(edge.toId, nextHops);
        previous.set(edge.toId, { playerId: currentId, edge });
        unsettled.add(edge.toId);
      }
    }
  }

  const bottleneckMatches = bestBottleneck.get(endId);
  if (!bottleneckMatches) return null;

  const chain = [endId];
  const edges: AdvantageEdge[] = [];
  let cursor = endId;
  while (cursor !== startId) {
    const item = previous.get(cursor);
    if (!item) return null;
    edges.unshift(item.edge);
    chain.unshift(item.playerId);
    cursor = item.playerId;
  }

  return { chain, edges, bottleneckMatches };
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
            <p>
              {result.chain.map(getPlayerName).join(" → ")}
              {Number.isFinite(result.bottleneckMatches) && `，瓶颈边共 ${result.bottleneckMatches} 场`}
            </p>
          </div>
          <ol className="chain-steps">
            {result.edges.map((edge) => (
              <li key={`${edge.fromId}-${edge.toId}`}>
                <strong>{getPlayerName(edge.fromId)}</strong>
                <span>
                  {edge.fromWins}:{edge.toWins} 优，共 {edge.totalMatches} 场
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
