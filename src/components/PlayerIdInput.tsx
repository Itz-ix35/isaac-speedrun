import { useMemo, useState } from "react";
import type { Player } from "../types/data";

type Props = {
  label: string;
  players: Player[];
  value: string;
  onChange: (value: string) => void;
};

export default function PlayerIdInput({ label, players, value, onChange }: Props) {
  const [focused, setFocused] = useState(false);
  const suggestions = useMemo(() => {
    const keyword = value.trim().toLowerCase();
    if (!keyword) return [];
    return players
      .filter((player) => player.displayName.toLowerCase().includes(keyword) || player.id.toLowerCase().includes(keyword))
      .slice(0, 20);
  }, [players, value]);
  const showSuggestions = focused && suggestions.length > 0;

  return (
    <label className="field player-id-field">
      <span>{label}</span>
      <input
        value={value}
        onBlur={() => setFocused(false)}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        placeholder="输入选手 id"
      />
      {showSuggestions && (
        <div className="player-id-suggestions">
          {suggestions.map((player) => (
            <button
              type="button"
              key={player.id}
              onMouseDown={(event) => {
                event.preventDefault();
                onChange(player.displayName);
                setFocused(false);
              }}
            >
              <span>{player.displayName}</span>
              <small>{player.id}</small>
            </button>
          ))}
        </div>
      )}
    </label>
  );
}
