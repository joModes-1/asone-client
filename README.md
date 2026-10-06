# AsOne Logistics — Operations Runbook

How each part of the system works, who is allowed to do it, and the steps to
test it against real data.

Built by **ERA 92** for **AsOne Logistics**: a system of record for uniform
pricing, stock and orders across three Tailoring Centres, two warehouses and
ten-plus schools in rural Uganda.

> Everything in this runbook was read from the running system, not invented.
> Where something is missing or undecided, it says so rather than describing
> what it ought to do.

---

## Contents

| | |
|---|---|
| [00](#00--before-you-start) | Before you start |
| [01](#01--the-order-lifecycle) | The order lifecycle |
| [02](#02--pricing) | Pricing |
| [03](#03--production-orders) | Production orders |
| [04](#04--receiving) | Receiving |
| [05](#05--inventory) | Inventory |
| [06](#06--inventory-history) | Inventory history |
| [07](#07--stock-correction) | Stock correction |
| [08](#08--settings-and-reason-codes) | Settings and reason codes |
| [09](#09--accounts-and-profiles) | Accounts and profiles |
| [10](#10--known-gaps-and-open-questions) | Known gaps and open questions |

---

## 00 · Before you start

### Running it

Two processes, two terminals.

```bash
# API — from the server directory
.venv/bin/python manage.py runserver          # :8000

# App — from the client directory
npm install && npm run dev                    # :5173
```

Open **http://localhost:5173**.

### The sign-in quirk

Signing in asks for a **six-digit code sent by email**. In development there
is no mail server, so the code is **printed in the Django terminal**. Watch
that window after you submit the password — the browser sits on the code
screen waiting for it.

### Accounts

One account per role is enough to walk the whole system. Each role sees a
genuinely different app, so testing as only one of them will miss most of it.

| Role | Account | Site | What they alone can do |
|---|---|---|---|
| Program Lead | `bashir@era92.com` | All sites | Master data, prices, sizes, garments, user accounts |
| Finance | `musana@asone.test` | All sites | Release orders for payment; post stock adjustments |
| Warehouse Staff | `julius@asone.test` | Namayemba | Receive, pick, despatch |
| School Staff | `chrisis@asone.test` | Namayemba Primary | Place orders; confirm deliveries arrived |

### Two rules of thumb

**A missing control is deliberate.** If a button is absent rather than greyed
out, that is the design. Roles that may not do something are not shown a
button that would fail — they are told who can do it instead. A greyed-out
control implies the permission exists somewhere and sends people hunting for
it.

**Every screen has a help button** — top right, the circled question mark. It
explains that screen in the app's own words, including the rules too long to
sit on the page. Check there before reporting something as unclear; and if
the help is *also* unclear, that itself is worth reporting.

---

## 01 · The order lifecycle

Five states, and a different person moves the order at each one. Almost every
test below is a step on this spine.

| State | Means | Who moves it |
|---|---|---|
| **HOLD** | Placed and invoiced, awaiting payment | School Staff places it |
| **RELEASED** | Payment confirmed. Only now may the warehouse touch it | Finance releases it |
| **PICKED** | Off the shelf and boxed — *still inside the warehouse* | Warehouse Staff picks it |
| **SHIPPED** | On the van. Stock has now left the building | Warehouse Staff despatches it |
| **COMPLETED** | The school says it arrived | School Staff confirms receipt |

### Three things worth knowing

**Releasing *is* the payment confirmation.** There is no separate "mark as
paid" step, because there would be nothing for it to do — the order records
who released it, when, and against which payment reference.

**Picked and Shipped are different physical facts.** Picking moves stock from
*Available* to *Reserved* at the same warehouse — the total does not change,
only how much is still free to promise somebody else. Shipping is when it
actually leaves.

**Shipped and Completed are deliberately separate.** A parcel that left three
weeks ago and never arrived looks exactly like one that arrived safely,
unless somebody confirms it. That gap is where losses live.

> **Despatch is per school.** One van carries every picked order for that
> school, so you despatch to *Bugiri High School*, not to *SO-20037*. Find it
> on **Shipping → To Pick**, in the "Ready to Despatch" panel — not the
> Despatched tab, which is the archive of vans that have already gone.

### Test it

1. As **School Staff**, place an order.
   → Expect it to appear as **Unpaid / On hold**.
2. As **Warehouse Staff**, try to pick it.
   → Expect a refusal: *"has not been paid for. An order must be released
   before the warehouse picks it."* This gate is enforced on both routes into
   picking, not just the obvious one.
3. As **Finance**, release it against a payment reference.
   → Expect the status to move to **Released** and the warehouse to gain the
   pick action.
4. Pick it, then despatch the school's van, then confirm receipt as the
   school.
   → Expect each step to be available only to the role named above.

---

## 02 · Pricing

### How it works

A price is **a period, not a number**. Each `GarmentPrice` row carries a start
date and an end date, so it does not say *"a White Shirt costs 25,000"* — it
says *"a White Shirt cost 25,000 between these dates."*

Real rows from the system:

| White Shirt (WSH) | From | Until |
|---|---|---|
| UGX 25,000 | 2026-01-01 | 2027-01-01 |
| UGX 28,000 | 2027-01-01 | open-ended |

**Changing a price never edits a row.** Repricing does two things: it *closes*
the open-ended row by stamping an expiry on it, then *opens* a new one. The old
row stays exactly as it was. That is why a March invoice reprinted next term
still shows March's price, however many times the price has moved since.
Editing in place would rewrite history and today's figure in one stroke.

Three details that matter in practice:

- **The end date is exclusive** — the field's own help text reads *"first day
  this price NO LONGER applies."* Above, 2027-01-01 is the first day of 28,000
  and the day 25,000 stops. Inclusive end dates make consecutive prices
  ambiguous on the changeover day, which is precisely the day somebody raises
  an invoice and asks which price was right.
- **Postgres enforces it, not the app.** An exclusion constraint
  (`no_overlapping_garment_prices`) means two rows can never claim the same
  garment on the same day. It holds against the admin, a management command, a
  CSV import and two simultaneous requests alike, so the price of a shirt stays
  a fact rather than a question.
- **Price hangs off the garment, not the SKU** — a Blue Tunic costs the same in
  size 8 and size 16. A size premium cannot exist in this model.

`unit_price` is one figure used for **both** purchase and selling price — that
is AsOne's own practice, not a simplification. It is a `Decimal`, never a
float, because a rounding error in a kit price is a rounding error on an
invoice.

*Program Lead sets prices · Finance reads lists · Schools see prices when ordering*

### Test it

Everything here is on screens open from Foundation, so it can be tested in the
first client build.

1. As a **Program Lead**, go to **Inventory → Garments**.
   → Expect a **Price today** column and an **Action** column. Any unpriced
   garment reads **Not priced** in red, with an amber banner above counting
   them.
2. Click **Price** on any row. Set a new amount and an *Applies from* date.
   → Expect the dialogue to list the full price history underneath, **oldest
   periods intact**. That is the thing to look for — nothing should have been
   overwritten.
3. Reprice **White Shirt**, which already has the two periods above.
   → Expect both of them still present and unchanged afterwards, with your new
   one added.
4. Go to **Reports → Pricing Reports → View Report**.
   → Expect the Primary School list, and an amber banner naming any unpriced
   garment.
5. Switch the list to **High School**.
   → Expect a different, shorter set. Garments marked for both levels appear on
   each list.
6. Set the date to **2025-01-01**.
   → Expect an empty list — nothing was priced then. This proves the date
   control is real rather than decorative.
7. Give the named garment a price, then reload the report.
   → Expect the amber banner to clear and the garment to join the list.
8. **Try to break it.** Reprice a garment with a date that overlaps a period it
   already has.
   → Expect a refusal: *"This garment already has a price covering part of that
   period. Close the existing price first."* That message comes from the
   database, not the form.

> **Why the banner matters.** A garment with no price on the chosen date is
> *left off the list entirely*, never shown at zero — a line with no price is
> worse than no line on a document a school buys from. But that omission is
> invisible, which is why the gap report is a banner on the page rather than a
> second screen somebody has to remember to open.

> **Open question for AsOne.** Should a price change apply from a chosen date,
> or immediately? The system does dated, which is the safer choice and what
> makes the audit trail work — but nobody at AsOne has confirmed it. If they
> expect "change it and it is changed, now", the behaviour is identical for the
> common case (set the date to today) and only the screen would be simpler.

---

## 03 · Production orders

What the warehouses ask the Tailoring Centres to make.

### How it works

A production order is a warehouse's order on a Tailoring Centre: a header
naming the TC, the destination warehouse and a due date, plus lines of SKUs
and quantities. Header and lines are written in **one transaction** — there is
no half-saved order.

It carries a **fulfilment status that is calculated, not typed**: the system
sums what has actually been received against it. That is what makes an order
show as *Awaiting delivery*, *Partially received* or *Received* without
anybody maintaining a field.

Deciding what to ask a TC to make is a **programme decision, not a warehouse
one**. Warehouse staff and Finance can read the queue — a clerk receives
against it — but neither can raise one.

*Program Lead and Operations Manager raise · Warehouse Staff reads own site · Finance reads*

### Test it

1. As **Program Lead**, open **Production Orders**.
   → Expect the open orders, filterable by status, centre and warehouse, ten
   to a page.
2. Open any order.
   → Expect the SKU manifest on one side, receipt history on the other.
3. Raise a new order: pick a Tailoring Centre, a destination warehouse, a due
   date, and at least one SKU line.
   → Expect it to appear in the list as **Open** with nothing received.
4. Cancel an order that has received nothing.
   → Expect it to move to **Cancelled** and stay in the list. A cancellation
   is a status change, never a delete — the document funds a Tailoring
   Centre, so it must survive being withdrawn.
5. Try to cancel an order that has **already had a delivery** against it.
   → Expect a refusal. Goods have moved; the paperwork cannot pretend
   otherwise.
6. Sign in as **Warehouse Staff** and open the same screen.
   → Expect the list but no button to raise one, and Namayemba's clerk should
   not see Serere's orders.

---

## 04 · Receiving

Recording a delivery against a production order, and the differences against
the packing list.

### How it works

A four-step wizard: **choose the order → enter the packing list number →
count against the manifest → confirm**. You cannot advance past step two
without the packing list number, because the whole point is checking goods
against a document.

On the compare step the system shows, per SKU, what the order **expected** and
what you actually **counted**. Those two figures are stored separately and
never reconciled into one — *the difference is the thing the warehouse is
meant to resolve*, and averaging it away would hide it.

A zero **net** difference is not a clean delivery. Ten short on one size and
ten over on another nets to nothing and is two errors; the summary says so
rather than showing a reassuring zero.

Confirming does two things: it writes the receipt, then **posts it to
inventory**, which is what actually raises stock at the receiving warehouse.

*Warehouse Staff (own site) · Program Lead · Operations Manager*

### Test it

1. As **Warehouse Staff**, open **Receiving** and choose an open production
   order.
   → Expect the expected-inventory preview to fill in on the right.
2. Try to continue without a packing list number.
   → Expect to be blocked. This is not a bug.
3. Enter any packing list number and continue to **Compare**.
   → Expect every line pre-filled with the expected count, all matching, and
   a dash in the Reason column.
4. Reduce one line's count by five.
   → Expect that row to turn amber, the Diff to read **−5**, and a **Reason
   box to appear on that row only**.
5. Type a reason — "Two cartons soaked in transit".
   → Expect it accepted up to 200 characters.
6. Confirm and finalise.
   → Expect *"posted to inventory — stock has been raised"*, and a printable
   manifest.
7. Open the production order you received against.
   → Expect the receipt in its history, marked **confirmed**, noting a
   discrepancy was recorded.
8. Check **Inventory** for one of the SKUs you received.
   → Expect Available to have risen by exactly what you **counted**, not what
   was expected.

---

## 05 · Inventory

The inventory database, and the minimum level that decides what counts as low.

### How it works

One row per **SKU per warehouse**. The same shirt in two warehouses is two
rows, because stock is held at a site and never as one national figure.

Three columns that are easy to confuse:

- **Available** — can be promised to a new order.
- **Pick** — already reserved for an order somebody is picking.
- **Shipped** — has left the building.

This is why Available can read **0** while the shelf is not empty: the stock
exists but is already promised.

**Available is never stored.** It is summed from the stock ledger on every
read, so there is no figure that can go stale. A brand-new SKU reads zero
because nothing has moved yet — stock arrives through receiving, a bulk
import, or an adjustment.

The **minimum** is set per SKU per warehouse, because two warehouses serve
different numbers of schools. A quantity turns amber at or below it, and it is
what the reorder alert and the dashboard count as low.

> **A school clerk sees this screen differently, on purpose.** They get one
> row per SKU with stock **totalled across all warehouses**, headed *All AsOne
> warehouses* — not a row per site. A school does not order from a warehouse,
> it orders from AsOne, and which site fills the order is AsOne's allocation
> decision. So the question a school brings here is "does this exist and can I
> get it", not "where is it".

*Program Lead creates SKUs and sets minimums · Warehouse Staff reads own site · Finance reads all · School reads totals*

### Test it

1. Open **Inventory** and click any row.
   → Expect a panel beside the table: stock at every warehouse, its value, and
   recent movements.
2. Click **Edit SKU**.
   → Expect Description, a *Minimum at [warehouse]* field, and a "can be
   ordered" toggle. Garment and size are shown but locked.
3. Set the minimum **above** the current Available figure and save.
   → Expect a confirmation naming the SKU and warehouse.
4. Re-open the same row.
   → Expect your number to have stuck.
5. Look at the quantity in the table, and at the dashboard.
   → Expect it amber, and counted in Low Stock.
6. Create a new SKU with **Create New SKU**.
   → Expect the SKU number to be composed and shown **before** you save — e.g.
   `BTU-12` — and Available to read 0 afterwards.
7. Sign in as **School Staff** and open Inventory.
   → Expect every SKU listed, the Warehouse column reading *All AsOne
   warehouses*, and **no** Create SKU button or Garments tab.

> **Why a new SKU reads zero.** Because nothing has moved. That is correct,
> not a bug. Three legitimate ways to put stock in: receive it against a
> production order, import a stock count, or post an adjustment.

---

## 06 · Inventory history

The audit trail — every transaction, reachable by SKU.

### How it works

This is the ledger itself: every movement in and out of every warehouse you
can see, newest first, with the document that caused it and the person who
posted it.

It answers a different question from Adjustments. *"What did Finance change,
and why"* is the adjustments screen. *"Where did these 640 units go"* is this
one — and it is the only screen that can answer it, because it shows all eight
movement types rather than the one kind adjustments covers.

**Quantity is signed.** Positive came in, negative went out, and the colour
follows the sign.

The **Stock** column is what stops the ledger reading as nonsense. A single
pick posts two rows at the same warehouse on the same day — **−544** out of
Available and **+544** into Reserved. Without the status those look like a
contradiction; with it, they are stock reserved rather than stock gone.

**Nothing here can be edited or deleted**, by anybody, including through the
API. Stock levels are summed from these rows, so changing one would rewrite
history and today's figure at the same time. A wrong movement is corrected by
posting an offsetting one.

*Warehouse Staff (own site) · Finance (all sites) · Program Lead · School: no access*

### Test it

1. Open **Inventory & Products → Stock History**.
   → Expect the last 30 days, ten rows to a page.
2. Filter SKU to `BTU-8` and Date Range to **All Time**.
   → Expect every event in that product's life.
3. Find a **Pick** row and look at the pair around it.
   → Expect **−544** Available and **+544** Reserved, same day, same
   warehouse.
4. Scroll the table sideways.
   → Expect Value, Document and Posted by. Document names the paper behind
   it: `RC-` receipt, `SH-` shipment, `ADJ-` adjustment, `WT-` transfer,
   `SO-` school order.
5. Set Movement to **Adjustment**.
   → Expect the count to fall and the page to reset to 1. Every filter is
   applied by the server, so an empty table means nothing matched in the
   *whole* ledger — not just this page.
6. Sign in as **School Staff**.
   → Expect no Stock History entry in the sidebar at all.

---

## 07 · Stock correction

Fixing a wrong quantity, with a reason and a trail.

### How it works

A correction is the one case where **the system does the subtraction**. You
enter what was physically counted; it compares that to what it believes is on
hand and posts the difference itself, against `CORR_UP` or `CORR_DOWN`. You
never choose the direction — that is what stops a correction being typed the
wrong way round.

If the count matches, **nothing is posted at all** and it says so. A success
with no document would otherwise read as a failure.

Other adjustments — returns, damages, losses — use a **reason code** that
carries its own direction. See [section 08](#08--settings-and-reason-codes).

**Nothing is editable and nothing is deleted.** A wrong adjustment is
corrected by posting an offsetting one, which is why there is no row action
and no bin icon.

*Finance posts adjustments · Program Lead transfers only · Warehouse Staff: no access*

### Test it

1. As **Finance**, open **Inv. Adjustments**.
   → Expect the last 30 days, with type, quantity and reason per row.
2. Click **New Adjustment** and choose the count-correction panel. Pick a SKU
   and warehouse.
   → Expect the system's current figure shown before you type anything.
3. Enter a counted figure **lower** than the system's, and post.
   → Expect an `ADJ-` number, a negative quantity, and `CORR_DOWN` chosen for
   you.
4. Repeat with a count that **matches** exactly.
   → Expect *"the count matched — nothing was posted"*. No document is
   created.
5. Open **Stock History** and filter to that SKU.
   → Expect your correction in the ledger with your name and the `ADJ-`
   document number.
6. Try to reach Adjustments as **Warehouse Staff**.
   → Expect no sidebar entry. The matrix gives this column to Finance alone.

---

## 08 · Settings and reason codes

Two tabs: **System Settings** and **Adjustment Reason Codes**.

### How it works

**System Settings** holds the organisation name, defaults, inventory
parameters and alert preferences. Everyone signed in can *read* it — timezone
and currency are needed to render the app consistently whatever your role —
but only a Program Lead or Operations Manager can change it. A role that
cannot edit sees a notice saying so, not a page of dead inputs.

**Adjustment Reason Codes** is the lookup table behind every stock adjustment:
why stock moved, and which way. It lives on Settings because the *leads*
maintain it and the leads cannot open the Adjustments screen at all — that
column is Finance's. Putting the editor beside the adjustments would have
hidden it from its own audience.

Six codes are active today, plus one retired:

| Code | Effect | Meaning |
|---|---|---|
| `CORR_UP` | Adds | Count correction upward |
| `CORR_DOWN` | Removes | Count correction downward |
| `RET` | Adds | Returned |
| `DMG` | Removes | Damaged |
| `LOSS` | Removes | Lost |
| `XFER` | Removes | Transferred out |
| `CORR` | *retired* | Superseded by the two directional codes |

**Direction is the field that matters.** It decides whether posting against a
code adds to stock or removes from it, so nobody posting an adjustment ever
chooses a sign — they pick a reason and the code carries the arithmetic.

**It cannot be changed afterwards.** Flipping the direction of a code already
in use would silently reverse the meaning of every adjustment posted against
it, including ones years old. A wrong code is retired and replaced.

**Nothing is deleted.** Retiring keeps a code on every adjustment already
posted while taking it out of the choices for new ones. The server has no
DELETE either — an audit trail that cannot say why a movement happened is not
an audit trail.

### Test it

1. As **Program Lead**, open **Settings**.
   → Expect two tabs, and an amber warning on the reason codes tab about
   direction being permanent.
2. Add a code. Give it a direction using the two plain statements ("Removes
   stock — damaged, lost, written off" / "Adds stock — returned, found,
   recovered").
   → Expect it to appear in the table as **In use**.
3. Retire it.
   → Expect it to become **Retired** and stay in the table. There is no delete.
4. As **Finance**, post an adjustment.
   → Expect the retired code to be absent from the choices, and the active
   ones present.
5. As **School Staff**, open Settings.
   → Expect the System Settings tab only, every field read-only, and a blue
   notice saying a Program Lead or Operations Manager makes the changes.

---

## 09 · Accounts and profiles

### How it works

**My Profile** — everyone has one, reachable from the sidebar and from your
own name and face at the foot of the rail.

What you may change about yourself: **your name and your phone number.** That
is all, and that is the point — they are the two things on your record that
are genuinely yours to correct.

What you may **not** change:

- **Your email.** It is the credential you sign in with *and* the address your
  sign-in code is sent to, so a typo locks the account out of the only channel
  that could deliver the correction. **Not even a lead can change one** —
  there is no screen in AsOne that does it, and the API refuses it too.
- **Your role and your site.** A lead's to set, from Users & Roles. Nobody
  changes their own role, including a Program Lead — that is separation of
  duties working, not a gap.

**Users & Roles** is the leads' screen: create an account, change somebody's
role or site, reset a password, deactivate. A new account is given a password
shown **once**, which you pass on yourself — it is never emailed. The person
confirms their address with an emailed code and is made to choose their own
password at first sign-in.

*Program Lead and Operations Manager administer accounts · everyone else has My Profile only*

### Test it

1. Sign in as any role and click **your own name at the bottom of the
   sidebar**.
   → Expect your profile. This works for every role, whatever else is on the
   rail.
2. Click **Edit details**.
   → Expect three fields — first name, last name, phone number — and **no
   email field**.
3. Change your name and save, then look at the sidebar.
   → Expect the new name there immediately, not after a sign-out.
4. As **Program Lead**, open **Users & Roles** and edit somebody.
   → Expect name, phone and role — and **no email field** here either. The
   address shows as the dialogue's subtitle so you can still see whose record
   it is.
5. Sign out and submit the sign-in form **completely empty**.
   → Expect *"Enter your email address"* and *"Enter your password"* under the
   fields — **not** a message about lacking permission.

---

## 10 · Known gaps and open questions

Everything below is known. Nothing here is a surprise waiting to be found in
testing.

### Gaps

| Area | What is missing | Impact |
|---|---|---|
| Production orders | Amending lines is not built | Spec calls it a "Should". The server rejects an attempt rather than silently ignoring it, so nobody gets the false impression it worked |
| Receiving | No way to re-post a receipt whose posting failed | Rare. The production order correctly shows it as "recorded — not posted", but the message names an action there is no button for |
| Inventory | Four columns are always empty for a school clerk | Level, Color, Min. Stock and Shipped read as dashes or zero, because schools may not read garments, minimums or the ledger. Candidate for hiding per role |
| Settings | Four stored settings are not yet read by anything | Critical safety buffer %, auto-trigger TC reorder, and both printing preferences. All labelled, none wired |
| Reports | Adjustments are not costed | The last Phase 2 item |

### Questions for AsOne

Each one is a decision we made on AsOne's behalf because the brief did not
settle it. All are cheap to confirm now and expensive to discover later. The
first three change built behaviour; the rest confirm it.

**Blocking — a built behaviour changes when they answer**

1. **Who is "School Monitor"?**
   Their chart says an order waits on Hold until School Monitor confirms
   payment, and nobody has said what that is — a person, a role, a
   spreadsheet, another system. We have coded it as **Finance**: our reading,
   not their instruction. One permission class changes when they answer.

2. **Should a price change apply from a chosen date, or immediately?**
   The system does **dated** — you pick when the new price starts and may set
   it in the future. Safer, and it is what makes a reprinted invoice match the
   original. If they expect "change it and it is changed, now", the behaviour
   is identical for the common case and only the screen gets simpler.

3. **Can a garment ever cost more in a larger size?**
   Price is attached to the **garment**, so every size shares one price — a
   size premium is not unbuilt, it is *impossible* in the model. If the
   intention was ever a price per SKU, this is the moment to say so; changing
   it later means moving the price table and every report that reads it.

**Confirming — we believe the behaviour is right, but nobody has said so**

4. **Should inventory value count Available only, or Available plus reserved?**
   Today a SKU with 640 units reserved against orders is valued at nothing.
   The stock is real and in the building; only the arithmetic disagrees.

5. **Should the warehouse be able to post the count it takes?**
   The warehouse counts the shelf but only Finance can post the result. That
   is what the access matrix says, and it may well be deliberate separation of
   duties — worth confirming whoever counts is content to hand the number to
   somebody else to enter.

6. **What happens when a delivery arrives damaged?**
   The school can record a note against it and nothing acts on that note.
   Inventing a process would be worse than leaving it for a person to read,
   but somebody should know the note is all there is.

7. **Does every school have a working computer?**
   If not, somebody enters orders on their behalf and the permissions change —
   the point of sale stops being School Staff only.

8. **Do we need students per school?**
   Orders carry a free-text student name; students have no accounts and the
   school is the customer. Schools already carry a student count. Worth
   confirming that is enough before anybody builds a student record.

---

*Prepared by ERA 92 for AsOne Logistics.*
