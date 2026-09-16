import DynamicIcon from "@/helpers/DynamicIcon";

/** A record's image, or the placeholder tile when it has none. Ported from
 * web-shared/ui.tsx — a plain <img>, not next/image, since these are
 * external Shopify CDN URLs and this is a thumbnail-sized tile. */
export default function Thumb({ src, alt = "", size = 40, className = "" }: { src?: string | null; alt?: string; size?: number; className?: string }) {
  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden bg-(--well) text-(--ink-faint) ${className}`}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.22) }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} width={size} height={size} className="h-full w-full object-cover" />
      ) : (
        <DynamicIcon icon="FaImage" style={{ fontSize: Math.round(size * 0.42) }} />
      )}
    </span>
  );
}
