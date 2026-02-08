import * as React from "react"
import { cn } from "@/lib/utils"

export interface OptimizedImageProps
  extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string
  alt: string
  srcSet?: string
  sizes?: string
  loading?: "lazy" | "eager"
  fallback?: string
  webp?: string
}

export function OptimizedImage({
  src,
  alt,
  srcSet,
  sizes,
  loading = "lazy",
  fallback,
  webp,
  className,
  ...props
}: OptimizedImageProps) {
  // Responsive sizes if not provided
  const defaultSizes =
    sizes ||
    "(max-width: 640px) 400px, (max-width: 1024px) 800px, 1200px"

  // Generate srcSet if not provided
  const defaultSrcSet = srcSet || [
    `${src}?w=400 400w`,
    `${src}?w=800 800w`,
    `${src}?w=1200 1200w`,
  ].join(", ")

  return (
    <picture>
      {/* WebP format (modern browsers) */}
      {webp && (
        <source
          srcSet={defaultSrcSet.replace(/\.(jpg|jpeg|png)/g, ".webp")}
          type="image/webp"
          sizes={defaultSizes}
        />
      )}
      {/* Fallback format */}
      <source
        srcSet={defaultSrcSet}
        type="image/jpeg"
        sizes={defaultSizes}
      />
      {/* Fallback image */}
      <img
        src={fallback || src}
        alt={alt}
        loading={loading}
        className={cn("max-w-full h-auto", className)}
        decoding="async"
        {...props}
      />
    </picture>
  )
}

