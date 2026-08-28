import { useState } from 'react';

/** First letter of each word, so a failed load still identifies the pack. */
export function initialsFor(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('');
}

/**
 * Product thumbnail. The images are remote, so a slow or blocked host must not
 * leave a broken-image icon on the first screen: on error we swap to a
 * lettered placeholder that occupies exactly the same box, so the layout never
 * shifts either way.
 */
export default function ProductImage({
  src,
  name,
  size = 64,
}: {
  src?: string;
  name: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size };

  if (!src || failed) {
    return (
      <span
        role="img"
        aria-label={name}
        style={box}
        className="flex shrink-0 items-center justify-center rounded-lg border border-case-edge bg-window text-sm font-semibold text-gold"
      >
        {initialsFor(name)}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      style={box}
      className="shrink-0 rounded-lg border border-case-edge object-cover"
    />
  );
}
