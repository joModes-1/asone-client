import { chromium } from 'playwright'
import { readFileSync } from 'fs'
const all = JSON.parse(readFileSync('/tmp/alltokens.json','utf8'))
const b = await chromium.launch()
for (const [role, { access, refresh }] of Object.entries(all)) {
  const ctx = await b.newContext(); const p = await ctx.newPage()
  await p.goto('http://localhost:5173/')
  await p.evaluate(([a,r]) => { localStorage.setItem('asone.access',a); localStorage.setItem('asone.refresh',r) }, [access, refresh])
  await p.goto('http://localhost:5173/inventory', { waitUntil: 'networkidle' })
  await p.waitForTimeout(4500)
  const cells = []
  for (const tr of (await p.locator('tbody tr').all()).slice(0,3)) {
    const tds = await tr.locator('td').allTextContents()
    cells.push(`${(tds[0]??'').trim().slice(0,22)} level=${(tds[3]??'').trim()} colour=${(tds[5]??'').trim() || '—'}`)
  }
  console.log(`${role.padEnd(20)}\n   ` + cells.join('\n   '))
  await ctx.close()
}
await b.close()
