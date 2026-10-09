/** Pre-generated catalogue photo of a product in one of the standard colours (see scripts/pregen-colors.mts). */
export const stockColorFile = (productId: string, hex: string) => `/merch/colors/${productId}-${hex.replace("#", "").toUpperCase()}.jpg`;
