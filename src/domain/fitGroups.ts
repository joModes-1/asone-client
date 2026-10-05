/**
 * The class band a garment is cut for, and the price list that follows.
 *
 * ---------------------------------------------------------------------------
 * Why a form asks for this and not for the school level
 * ---------------------------------------------------------------------------
 * They sound like the same question and are not. The school level says which
 * *price list* a garment appears on — Primary or High School, AsOne's two.
 * The fit group says which *classes wear it*, and AsOne have five bands: a
 * P1–P4 sweater and a P5–P7 sweater are both Primary and are not the same
 * garment.
 *
 * The bands nest inside the price lists, so the server derives one from the
 * other (`Garment.PRICE_LIST_BY_FIT_GROUP`) and refuses a pair that
 * disagrees. Asking for both would be asking somebody the same question
 * twice and letting them get it wrong.
 *
 * `PRICE_LIST_BY_FIT_GROUP` below mirrors the server's table so a form can
 * show what it is about to imply. The server decides; this only explains.
 */

import type { GarmentSchoolLevel } from '@/api/types'

export const FIT_GROUPS = [
  { value: 'NUR', label: 'Nursery' },
  { value: 'P14', label: 'Lower Primary (P1–P4)' },
  { value: 'P57', label: 'Upper Primary (P5–P7)' },
  { value: 'S14', label: 'O Level (S1–S4)' },
  { value: 'S56', label: 'A Level (S5–S6)' },
  { value: 'ALL', label: 'All levels' },
] as const

export type FitGroup = (typeof FIT_GROUPS)[number]['value']

const PRICE_LIST_BY_FIT_GROUP: Record<FitGroup, GarmentSchoolLevel> = {
  NUR: 'PS',
  P14: 'PS',
  P57: 'PS',
  S14: 'HS',
  S56: 'HS',
  ALL: 'BOTH',
}

const PRICE_LIST_LABEL: Record<GarmentSchoolLevel, string> = {
  PS: 'the Primary price list',
  HS: 'the High School price list',
  BOTH: 'both price lists',
}

export function fitGroupLabel(value: string | null | undefined): string {
  return FIT_GROUPS.find((g) => g.value === value)?.label ?? '—'
}

/** "Nursery garments appear on the Primary price list." */
export function priceListNote(value: string | null | undefined): string | null {
  const level = PRICE_LIST_BY_FIT_GROUP[value as FitGroup]
  if (!level) return null
  return `Appears on ${PRICE_LIST_LABEL[level]}.`
}
