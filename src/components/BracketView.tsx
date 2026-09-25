import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { Bracket, BracketNode, DoubleElimBracketEntry, SwissBracketEntry } from "../types/data";

type Props = {
  bracket: Bracket | null;
  fullPage?: boolean;
};

const getNodeLink = (bracket: Bracket, node: BracketNode) => {
  if (!node.matchIds?.length) return null;
  const params = new URLSearchParams({
    tournament: bracket.tournamentId,
    stage: node.roundName
  });
  if (node.seriesId) params.set("series", node.seriesId);
  return `/competitions?${params.toString()}`;
};

const renderCard = (bracket: Bracket, node: BracketNode, label?: string) => {
  const link = getNodeLink(bracket, node);
  const content = (
    <>
      <span className="bracket-round">{label ?? node.roundName}</span>
      <strong>{node.championName ?? node.winnerName ?? node.playerName ?? "待定"}</strong>
      {node.score && (
        <span className="bracket-score">
          {node.format} {node.score}
        </span>
      )}
      {node.loserName && <span className="bracket-loser">胜 {node.loserName}</span>}
    </>
  );

  if (!link) {
    return <div className="bracket-card">{content}</div>;
  }

  return (
    <Link className="bracket-card bracket-card-link" to={link}>
      {content}
    </Link>
  );
};

const getSwissEntryLink = (bracket: Bracket, entry: SwissBracketEntry) => {
  const params = new URLSearchParams({
    tournament: bracket.tournamentId,
    stage: entry.stageName
  });
  if (entry.seriesId) params.set("series", entry.seriesId);
  return `/competitions?${params.toString()}`;
};

const getSwissStageBalance = (stageName: string) => {
  const match = stageName.match(/^(?:16 强 )?(\d+):(\d+) 分组$/);
  if (!match) return 0;
  return Number(match[1]) - Number(match[2]);
};

const getSwissStageScore = (stageName: string) => {
  const match = stageName.match(/^(?:16 强 )?(\d+):(\d+) 分组$/);
  if (!match) return null;
  return {
    wins: Number(match[1]),
    losses: Number(match[2])
  };
};

const renderSwissEntryCard = (bracket: Bracket, entry: SwissBracketEntry) => {
  const stageScore = getSwissStageScore(entry.stageName);
  const winnerClassName = stageScore?.wins === 2 ? "swiss-player advance" : "";
  const loserClassName = stageScore?.losses === 2 ? "swiss-player eliminate" : "";

  return (
    <Link className="swiss-card bracket-card-link" to={getSwissEntryLink(bracket, entry)}>
      <span className="bracket-round">{entry.stageName}</span>
      <strong className={winnerClassName}>{entry.winnerName}</strong>
      <span className="swiss-card-score">
        {entry.format} {entry.score} 胜
      </span>
      <strong className={loserClassName}>{entry.loserName}</strong>
    </Link>
  );
};

const getDoubleElimEntryLink = (bracket: Bracket, entry: DoubleElimBracketEntry) => {
  const params = new URLSearchParams({
    tournament: bracket.tournamentId,
    stage: entry.stageName
  });
  if (entry.seriesId) params.set("series", entry.seriesId);
  return `/competitions?${params.toString()}`;
};

const renderDoubleElimCard = (bracket: Bracket, entry: DoubleElimBracketEntry, isLosersBracket = false) => (
  <Link className="double-elim-card bracket-card-link" to={getDoubleElimEntryLink(bracket, entry)}>
    <span className="bracket-round">{entry.stageName}</span>
    <strong>{entry.winnerName}</strong>
    <span className="bracket-score">
      {entry.format} {entry.score} 胜
    </span>
    <strong className={isLosersBracket ? "eliminate" : ""}>{entry.loserName}</strong>
  </Link>
);

const getDepth = (node: BracketNode | null): number => {
  if (!node) return 0;
  if (!node.left && !node.right) return 1;
  return 1 + Math.max(getDepth(node.left ?? null), getDepth(node.right ?? null));
};

const isLeafNode = (node: BracketNode | undefined) => Boolean(node && !node.left && !node.right);

const renderHalfNode = (
  node: BracketNode | null,
  bracket: Bracket,
  direction: "upper" | "lower",
  maxDepth: number,
  depth = 1
) => {
  if (!node) return null;
  const isLeaf = !node.left && !node.right;
  const isDeepestLeaf = isLeaf && depth === maxDepth;
  const isFirstRound = Boolean(node.left && node.right && isLeafNode(node.left) && isLeafNode(node.right));
  const className = [
    "bracket-node",
    direction,
    isLeaf ? "leaf" : "",
    isDeepestLeaf ? "deepest-leaf" : "",
    isFirstRound ? "first-round" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      {direction === "lower" && renderCard(bracket, node)}
      {(node.left || node.right) && (
        <div className="bracket-children">
          {renderHalfNode(node.left ?? null, bracket, direction, maxDepth, depth + 1)}
          {renderHalfNode(node.right ?? null, bracket, direction, maxDepth, depth + 1)}
        </div>
      )}
      {direction === "upper" && renderCard(bracket, node)}
    </div>
  );
};

type ConnectorLine = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

function SpecialBracket({ bracket, zoom }: { bracket: Bracket; zoom: number }) {
  const children = bracket.root?.children ?? [];
  const upperChildren = children.slice(0, 2);
  const lowerChildren = children.slice(2);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const centerRef = useRef<HTMLDivElement | null>(null);
  const quadrantRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [lines, setLines] = useState<ConnectorLine[]>([]);

  useLayoutEffect(() => {
    const board = boardRef.current;
    const center = centerRef.current?.querySelector<HTMLElement>(".bracket-card");
    if (!board || !center) return;

    const readLines = () => {
      const boardRect = board.getBoundingClientRect();
      const centerRect = center.getBoundingClientRect();
      const toLocal = (rect: DOMRect, x: number, y: number) => ({
        x: (rect.left - boardRect.left + x) / zoom,
        y: (rect.top - boardRect.top + y) / zoom
      });

      const nextLines = quadrantRefs.current
        .map((quadrant, index) => {
          const card = quadrant?.querySelector<HTMLElement>(":scope > .bracket-half-inner > .bracket-node > .bracket-card");
          if (!card) return null;

          const cardRect = card.getBoundingClientRect();
          const isUpper = index < 2;
          const isLeft = index % 2 === 0;
          const source = toLocal(cardRect, cardRect.width / 2, isUpper ? cardRect.height : 0);
          const target = toLocal(
            centerRect,
            isLeft ? 0 : centerRect.width,
            isUpper ? 0 : centerRect.height
          );

          return {
            id: `${card.dataset.nodeId ?? card.textContent ?? "node"}-${index}`,
            x1: source.x,
            y1: source.y,
            x2: target.x,
            y2: target.y
          };
        })
        .filter((line): line is ConnectorLine => Boolean(line));

      setLines(nextLines);
    };

    readLines();
    const observer = new ResizeObserver(readLines);
    observer.observe(board);
    for (const quadrant of quadrantRefs.current) {
      if (quadrant) observer.observe(quadrant);
    }
    window.addEventListener("resize", readLines);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", readLines);
    };
  }, [bracket, zoom]);

  return (
    <div className="bracket-special-board" ref={boardRef}>
      <svg className="bracket-special-lines" aria-hidden="true">
        {lines.map((line) => (
          <line key={line.id} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />
        ))}
      </svg>
      <div className="bracket-special-row upper">
        {upperChildren.map((child, index) => (
          <div className="bracket-special-quadrant" key={child.id} ref={(element) => { quadrantRefs.current[index] = element; }}>
            <div className="bracket-half-inner">{renderHalfNode(child, bracket, "upper", getDepth(child))}</div>
          </div>
        ))}
      </div>
      <div className="bracket-special-center" ref={centerRef}>
        {bracket.root && renderCard(bracket, bracket.root, bracket.root.displayRoundName ?? bracket.root.roundName)}
      </div>
      <div className="bracket-special-row lower">
        {lowerChildren.map((child, index) => (
          <div className="bracket-special-quadrant" key={child.id} ref={(element) => { quadrantRefs.current[index + upperChildren.length] = element; }}>
            <div className="bracket-half-inner">{renderHalfNode(child, bracket, "lower", getDepth(child))}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SwissBracket({ bracket }: { bracket: Bracket }) {
  const rounds = bracket.swissRounds ?? [];
  const results = bracket.swissResults ?? [];
  const resultGroups = results.reduce<Array<{ wins: number; players: typeof results }>>((groups, player) => {
    const current = groups.find((group) => group.wins === player.wins);
    if (current) {
      current.players.push(player);
    } else {
      groups.push({ wins: player.wins, players: [player] });
    }
    return groups;
  }, []);

  return (
    <div className="swiss-board">
      {rounds.map((round) => (
        <section className="swiss-round" key={round.roundNumber}>
          <h3>第 {round.roundNumber} 轮</h3>
          <div className="swiss-round-cards">
            {round.entries.map((entry, index) => {
              const previous = round.entries[index - 1];
              const hasRankDivider = previous && getSwissStageBalance(previous.stageName) !== getSwissStageBalance(entry.stageName);
              return (
              <div className={hasRankDivider ? "swiss-card-wrap rank-divider" : "swiss-card-wrap"} key={entry.id}>
                {renderSwissEntryCard(bracket, entry)}
              </div>
              );
            })}
          </div>
        </section>
      ))}
      {resultGroups.length > 0 && (
        <section className="swiss-round swiss-result-round">
          <h3>最终结果</h3>
          <div className="swiss-result-groups">
            {resultGroups.map((group, index) => (
              <div className={index > 0 ? "swiss-result-group rank-divider" : "swiss-result-group"} key={group.wins}>
                <span className="bracket-round">{group.wins} 胜</span>
                <div className="swiss-result-players">
                  {group.players.map((player) => (
                    <span className="swiss-result-player" key={player.playerId}>
                      {player.playerName}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function HybridBracket({ bracket, zoom }: { bracket: Bracket; zoom: number }) {
  return (
    <div className="hybrid-bracket-board">
      <div className="hybrid-swiss-section">
        <SwissBracket bracket={bracket} />
      </div>
      <div className="hybrid-final-section">
        <SpecialBracket bracket={bracket} zoom={zoom} />
      </div>
    </div>
  );
}

function DoubleElimBracket({ bracket }: { bracket: Bracket }) {
  const rounds = bracket.doubleElimRounds ?? [];
  const getInitialPlayers = (entry: DoubleElimBracketEntry, droppedPlayerIds?: Set<string>) => {
    if (!droppedPlayerIds) return [entry.playerAName, entry.playerBName];
    const players = [
      { id: entry.playerAId, name: entry.playerAName },
      { id: entry.playerBId, name: entry.playerBName }
    ].filter((player) => !droppedPlayerIds.has(player.id));
    return players.length > 0 ? players.map((player) => player.name) : [entry.playerAName, entry.playerBName];
  };
  const renderEntryWrap = (entry: DoubleElimBracketEntry, initialPlayers: string[] = [], isLosersBracket = false) => (
    <div className={initialPlayers.length > 0 ? "double-elim-card-wrap with-initial" : "double-elim-card-wrap"} key={entry.id}>
      {initialPlayers.length > 0 && (
        <div className="double-elim-initial-players">
          {initialPlayers.map((playerName) => (
            <span key={playerName}>{playerName}</span>
          ))}
        </div>
      )}
      <div>{renderDoubleElimCard(bracket, entry, isLosersBracket)}</div>
    </div>
  );

  return (
    <div className="double-elim-board">
      <div className="double-elim-row-labels" aria-hidden="true">
        <div />
        <span>胜者组</span>
        <span>败者组</span>
      </div>
      {rounds.map((round) => (
        <section className="double-elim-cycle" key={round.cycleNumber}>
          <h3>第 {round.cycleNumber} 巡</h3>
          <div className="double-elim-cycle-grid">
            <div className="double-elim-lane winners">
              <div className="double-elim-phase early">
                <div className="double-elim-cards">
                  {round.winners.map((entry) => renderEntryWrap(entry, round.cycleNumber === 1 ? getInitialPlayers(entry) : []))}
                </div>
              </div>
              <div className="double-elim-phase late" />
            </div>
            <div className="double-elim-lane losers">
              <div className="double-elim-phase early">
                <div className="double-elim-cards">
                  {round.losersEarly.map((entry) => renderEntryWrap(entry, round.cycleNumber === 1 ? getInitialPlayers(entry) : [], true))}
                </div>
              </div>
              <div className="double-elim-phase late">
                <div className="double-elim-cards">
                  {round.losersLate.map((entry) => {
                    const showInitialOnly = round.cycleNumber === 1 && round.losersEarly.length === 0;
                    const droppedPlayerIds = new Set(round.winners.map((winnerEntry) => winnerEntry.loserPlayerId));
                    return renderEntryWrap(entry, showInitialOnly ? getInitialPlayers(entry, droppedPlayerIds) : [], true);
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>
      ))}
      {bracket.doubleElimFinal && (
        <section className="double-elim-cycle double-elim-final">
          <h3>决赛</h3>
          <div className="double-elim-final-card">{renderEntryWrap(bracket.doubleElimFinal)}</div>
        </section>
      )}
    </div>
  );
}

export default function BracketView({ bracket, fullPage = false }: Props) {
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0
  });
  const [boardWidth, setBoardWidth] = useState(0);
  const [boardHeight, setBoardHeight] = useState(0);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [scrollHeight, setScrollHeight] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);

  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    const updateSize = () => {
      setBoardWidth(board.scrollWidth);
      setBoardHeight(board.scrollHeight);
    };
    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(board);
    return () => observer.disconnect();
  }, [bracket]);

  useLayoutEffect(() => {
    setScrollWidth(Math.ceil(boardWidth * zoom));
    setScrollHeight(Math.ceil(boardHeight * zoom));
  }, [boardHeight, boardWidth, zoom]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const viewport = viewportRef.current;
      if (!viewport || !dragRef.current.isDragging) return;
      viewport.scrollLeft = dragRef.current.scrollLeft - (event.clientX - dragRef.current.startX);
      viewport.scrollTop = dragRef.current.scrollTop - (event.clientY - dragRef.current.startY);
      const top = topScrollRef.current;
      if (top) top.scrollLeft = viewport.scrollLeft;
    };

    const handleMouseUp = () => {
      if (!dragRef.current.isDragging) return;
      dragRef.current.isDragging = false;
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const changeZoom = (nextZoom: number, anchorClientX?: number, anchorClientY?: number) => {
    const viewport = viewportRef.current;
    const currentZoom = zoom;
    const currentScrollLeft = viewport?.scrollLeft ?? 0;
    const currentScrollTop = viewport?.scrollTop ?? 0;
    const rect = viewport?.getBoundingClientRect();
    const anchorX = rect && anchorClientX !== undefined ? anchorClientX - rect.left : viewport ? viewport.clientWidth / 2 : 0;
    const anchorY = rect && anchorClientY !== undefined ? anchorClientY - rect.top : viewport ? viewport.clientHeight / 2 : 0;
    const centerX = currentScrollLeft + anchorX;
    const centerY = currentScrollTop + anchorY;
    const unscaledCenterX = currentZoom > 0 ? centerX / currentZoom : centerX;
    const unscaledCenterY = currentZoom > 0 ? centerY / currentZoom : centerY;
    const clampedZoom = Math.min(1.5, Math.max(0.5, nextZoom));

    setZoom(clampedZoom);

    window.requestAnimationFrame(() => {
      const nextViewport = viewportRef.current;
      const top = topScrollRef.current;
      if (!nextViewport || !top) return;
      const nextScrollLeft = Math.max(0, unscaledCenterX * clampedZoom - anchorX);
      const nextScrollTop = Math.max(0, unscaledCenterY * clampedZoom - anchorY);
      nextViewport.scrollLeft = nextScrollLeft;
      nextViewport.scrollTop = nextScrollTop;
      top.scrollLeft = nextScrollLeft;
    });
  };

  const handleMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    dragRef.current = {
      isDragging: true,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop
    };
    setIsDragging(true);
  };

  const syncScroll = (source: "top" | "viewport") => {
    const top = topScrollRef.current;
    const viewport = viewportRef.current;
    if (!top || !viewport) return;

    if (source === "top") {
      viewport.scrollLeft = top.scrollLeft;
    } else {
      top.scrollLeft = viewport.scrollLeft;
    }
  };

  if (!bracket || (!bracket.root && !bracket.swissRounds?.length && !bracket.doubleElimRounds?.length)) {
    return <div className="empty">没有可还原的赛程图</div>;
  }

  const isDoubleElimBracket = Boolean(bracket.doubleElimRounds?.length);
  const isHybridBracket = Boolean(bracket.swissRounds?.length && bracket.root);
  const isSwissBracket = Boolean(bracket.swissRounds?.length && !bracket.root);
  const isSpecialBracket = Boolean(bracket.root?.children?.length);
  const upperDepth = getDepth(bracket.root?.left ?? null);
  const lowerDepth = getDepth(bracket.root?.right ?? null);

  return (
    <div className={fullPage ? "bracket-view full-page-bracket" : "bracket-view"}>
      <div className="bracket-toolbar" aria-label="赛程图缩放">
        <button type="button" onClick={() => changeZoom(zoom - 0.1)} disabled={zoom <= 0.5}>
          -
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => changeZoom(zoom + 0.1)} disabled={zoom >= 1.5}>
          +
        </button>
        <button type="button" onClick={() => changeZoom(1)} disabled={zoom === 1}>
          重置
        </button>
      </div>
      <div className="bracket-top-scroll" ref={topScrollRef} onScroll={() => syncScroll("top")}>
        <div style={{ width: scrollWidth, height: 1 }} />
      </div>
      <div
        className={isDragging ? "bracket-viewport dragging" : "bracket-viewport"}
        ref={viewportRef}
        onMouseDown={handleMouseDown}
        onScroll={() => syncScroll("viewport")}
      >
        <div className="bracket-scale-space" style={{ width: scrollWidth, height: scrollHeight }}>
          <div className="bracket-scale-content" style={{ transform: `scale(${zoom})` }}>
            <div className="bracket-board" ref={boardRef}>
              {isDoubleElimBracket ? (
                <DoubleElimBracket bracket={bracket} />
              ) : isHybridBracket ? (
                <HybridBracket bracket={bracket} zoom={zoom} />
              ) : isSwissBracket ? (
                <SwissBracket bracket={bracket} />
              ) : isSpecialBracket ? (
                <SpecialBracket bracket={bracket} zoom={zoom} />
              ) : bracket.root ? (
                <>
                  <div className="bracket-half upper">
                    <div className="bracket-half-inner">{renderHalfNode(bracket.root.left ?? null, bracket, "upper", upperDepth)}</div>
                  </div>
                  <div className="final-row">
                    {renderCard(bracket, bracket.root, "决赛")}
                    {bracket.thirdPlace && <div className="third-place-card">{renderCard(bracket, bracket.thirdPlace, "季军赛")}</div>}
                  </div>
                  <div className="bracket-half lower">
                    <div className="bracket-half-inner">{renderHalfNode(bracket.root.right ?? null, bracket, "lower", lowerDepth)}</div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      {bracket.warnings.length > 0 && (
        <section className="warning-box">
          <h3>数据检查</h3>
          {bracket.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </section>
      )}
    </div>
  );
}
