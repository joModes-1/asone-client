/**
 * The Settings screen — one document, not a list.
 *
 * Readable by anyone signed in; only Program Lead and Operations Manager can
 * write it, the same "Table Updates" gate as every other piece of master
 * data. The server enforces this — `update()` returning a 403 for anyone
 * else is the real check, not the screen hiding the form.
 */

import { get, patch } from './http'
import type { OrgSettings } from './types'

export function retrieve() {
  return get<OrgSettings>('/organization/settings/')
}

export function update(body: Partial<OrgSettings>) {
  return patch<OrgSettings>('/organization/settings/', body)
}
