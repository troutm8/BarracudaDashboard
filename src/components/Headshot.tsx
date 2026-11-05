export function Headshot({ src, name, size = 40, className = "" }: { src: string | null | undefined; name: string; size?: number; className?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} className={`shrink-0 rounded-full bg-soft object-cover ${className}`} style={{ width: size, height: size }} loading="lazy" />;
  }
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-soft text-xs font-semibold text-muted ${className}`} style={{ width: size, height: size }} aria-hidden>
      {initials}
    </span>
  );
}
