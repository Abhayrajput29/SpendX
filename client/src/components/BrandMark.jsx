export default function BrandMark({ className = 'brand-mark-svg' }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <path d="M8 11h5a4 4 0 0 0 4-4V6m-1 20v-1a4 4 0 0 1 4-4h4M8 21h4a4 4 0 0 0 4-4v-2a4 4 0 0 1 4-4h4" />
      <circle cx="8" cy="11" r="2.5" />
      <circle cx="24" cy="6" r="2.5" />
      <circle cx="8" cy="21" r="2.5" />
      <circle cx="24" cy="26" r="2.5" />
    </svg>
  );
}
