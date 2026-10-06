import { chromium } from 'playwright'
import { readFileSync } from 'fs'
const all = JSON.parse(readFileSync('/tmp/alltokens.json','utf8'))
const b = await chromium.launch()
for (const [role, { access, refresh }] of Object.entries(all)) {
  const ctx = await b.newContext(); const p = await ctx.newPage()
  await p.goto('http://localhost:5173/')
  await p.evaluate(([a,r]) => { localStorage.setItem('asone.access',a); localStorage.setItem('asone.refresh',r) }, [access, refresh])
  await p.goto('http://localhost:5173/inventory', { waitUntil: 'networkidle' })
  await p.waitForTimeout(4000)

  const carets = await p.locator('.split__caret').count()
  const labels = []
  for (const c of await p.locator('.split__caret').all()) labels.push(await c.getAttribute('aria-label'))
  const exportBtn = await p.getByRole('button', { name: /export csv/i }).count()
  const importItem = await p.getByText('Import stock count', { exact: false }).count()
  console.log(`${role.padEnd(20)} ExportCSV=${exportBtn}  carets=${carets} ${JSON.stringify(labels)}  importStockCountInDOM=${importItem}`)
  await ctx.close()
}
await b.close()
