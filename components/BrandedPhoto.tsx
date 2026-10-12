"use client";

import Image from "next/image";
import { useCart } from "@/components/CartProvider";
import { useBrandedImage } from "@/lib/brandedImage";

/** A catalogue photo that switches to the customer's branded version once it exists. */
export function BrandedPhoto({ productId, src, alt, width, height, sizes }: { productId: string; src: string; alt: string; width: number; height: number; sizes?: string }) {
  const { host } = useCart();
  const shown = useBrandedImage(productId, host, src);
  return <Image key={shown} className={shown === src ? undefined : "is-branded"} src={shown} alt={alt} width={width} height={height} sizes={sizes} unoptimized={/^(\/api\/|data:)/.test(shown)} />;
}
