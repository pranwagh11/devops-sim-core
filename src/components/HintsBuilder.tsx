interface Props {
  hints: string[];
  onChange: (hints: string[]) => void;
}

export default function HintsBuilder({ hints, onChange }: Props) {
  return (
    <div className="field-group">
      <label>Hints (optional, shown to learners in order)</label>
      {hints.map((h, i) => (
        <div className="row" key={i}>
          <input
            value={h}
            placeholder={`Hint ${i + 1}`}
            onChange={(e) => {
              const next = [...hints];
              next[i] = e.target.value;
              onChange(next);
            }}
          />
          <button type="button" className="btn-remove" onClick={() => onChange(hints.filter((_, idx) => idx !== i))}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" className="btn-add" onClick={() => onChange([...hints, ""])}>
        + Add hint
      </button>
    </div>
  );
}
