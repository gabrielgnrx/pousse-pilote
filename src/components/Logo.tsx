export function Sprout({ size = 28 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#1e5634" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21V11" />
      <path d="M12 13c-5 0-7-3.5-7-8 5 0 7 3.5 7 8Z" fill="#e4eddc" />
      <path d="M12 15c4 0 6-3 6-6.5-4 0-6 3-6 6.5Z" fill="#b9cc94" />
    </svg>
  );
}

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <Sprout />
      <span className="font-display text-2xl">Pousse</span>
    </div>
  );
}
