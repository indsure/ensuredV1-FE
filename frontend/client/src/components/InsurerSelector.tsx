const INSURERS = [
  { key: 'manipalcigna', name: 'ManipalCigna', logo: '🏥' },
  { key: 'starhealthinsurance', name: 'Star Health', logo: '⭐' },
  { key: 'hdfcergo', name: 'HDFC Ergo', logo: '🏦' },
  { key: 'nivabupa', name: 'Niva Bupa', logo: '💙' },
  { key: 'bajajAllianz', name: 'Bajaj Allianz', logo: '🔵' },
];

export function InsurerSelector({ onSelect }: { onSelect: (key: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 p-4">
      {INSURERS.map((ins) => (
        <button
          key={ins.key}
          onClick={() => onSelect(ins.key)}
          className="flex items-center gap-3 border rounded-xl p-4 hover:border-blue-500 hover:bg-blue-50 transition"
        >
          <span className="text-2xl">{ins.logo}</span>
          <span className="font-medium text-sm">{ins.name}</span>
        </button>
      ))}
    </div>
  );
}

