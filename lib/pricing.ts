// Seat pricing, same rule as reserve_seats in supabase/migrations/006_corporate_bundle.sql:
// exactly groupSize seats cost groupPricePerSeat each (the Corporate Bundle);
// any other count costs pricePerSeat each. The bundle is off while either field is null.
import type { Settings } from './booking-store'

type Prices = Pick<Settings, 'pricePerSeat' | 'groupSize' | 'groupPricePerSeat'> | null

export type Bundle = { size: number; total: number; saving: number }
export type Quote = { total: number | null; regular: number | null; bundle: boolean }

export function bundleOffer(settings: Prices): Bundle | null {
  if (!settings) return null
  const { pricePerSeat, groupSize, groupPricePerSeat } = settings
  if (pricePerSeat === null || groupSize === null || groupPricePerSeat === null) return null
  return { size: groupSize, total: groupSize * groupPricePerSeat, saving: groupSize * (pricePerSeat - groupPricePerSeat) }
}

export function quote(settings: Prices, count: number): Quote {
  const price = settings?.pricePerSeat ?? null
  const regular = price === null ? null : price * count
  const bundle = bundleOffer(settings)
  if (bundle && count === bundle.size) return { total: bundle.total, regular, bundle: true }
  return { total: regular, regular, bundle: false }
}
