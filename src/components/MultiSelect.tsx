type Props = {
  label: string;
  values: string[];
  selected: string[];
  onChange: (values: string[]) => void;
};

export default function MultiSelect({ label, values, selected, onChange }: Props) {
  const selectedSet = new Set(selected);
  const toggleValue = (value: string) => {
    if (selectedSet.has(value)) {
      onChange(selected.filter((item) => item !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="field multi-check">
      <div className="field-heading">
        <span>{label}</span>
        {selected.length > 0 && (
          <button type="button" onClick={() => onChange([])}>
            清空
          </button>
        )}
      </div>
      <div className="multi-check-summary">{selected.length === 0 ? "全部" : `已选 ${selected.length} 项`}</div>
      <div className="multi-check-options">
        {values.map((value) => (
          <label key={value} className="multi-check-option">
            <input type="checkbox" checked={selectedSet.has(value)} onChange={() => toggleValue(value)} />
            <span>{value}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
