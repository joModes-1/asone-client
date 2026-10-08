/**
 * What each screen means — the content behind the Help button.
 *
 * Written because this system has rules nobody guesses from the interface.
 * An order cannot be picked before Finance confirms payment; the stock
 * ledger is append-only so nothing is ever edited, only offset; a van goes
 * to a school rather than to an order. A clerk who does not know those will
 * read a refusal as a bug.
 *
 * Plain data, no React, so the wording can be reviewed by somebody who does
 * not read code — and so it can be handed to AsOne to correct. Everything
 * here describes behaviour that exists today; where a thing is deliberately
 * not built, it says so rather than staying silent.
 */

export interface HelpTopic {
  /** Route prefix this covers. Longest match wins, so detail beats list. */
  path: string
  /**
   * The `?tab=` this covers, for a screen whose tabs are different subjects.
   *
   * Omit it and the topic is the screen's default — which is what almost
   * every entry here is. Only reach for this where one help entry would have
   * to explain two unrelated things.
   */
  tab?: string
  title: string
  /** One idea per entry. Kept short — this is read standing up. */
  points: string[]
}

export const HELP_TOPICS: readonly HelpTopic[] = [
  {
    path: '/dashboard',
    title: 'Dashboard',
    points: [
      'Every figure here is the same number the screen behind it shows. If a tile and a report disagree, the report is right and the tile has a bug worth reporting.',
      'The warehouse selector at the top changes every figure on the page. "All warehouses" is the whole country; a warehouse clerk is pinned to their own site and is not offered the choice.',
      'Needs Attention only lists things somebody can act on today. An empty list means there is genuinely nothing waiting.',
    ],
  },
  {
    path: '/orders',
    title: 'School orders',
    points: [
      'An order is placed by the school and is its invoice — the number on screen is the number the parent was given. Orders are never deleted, only cancelled, because that number is already out in the world.',
      'A new order sits on Hold until payment is confirmed. Confirming payment is what releases it to the warehouse, so there is no separate "paid" step to tick.',
      'Only school staff place, amend or cancel an order. Finance confirms payment. The warehouse picks and ships. Each of those is a different person, and the buttons you see depend on which you are.',
      'Cancelling is only possible while the order is unpaid. After that, what happens to picked stock and money already taken is a question AsOne has not answered, so the system refuses rather than guessing.',
    ],
  },
  {
    path: '/shipments',
    title: 'Shipping and picking',
    points: [
      'Picking reserves stock. The moment you pick an order, those garments stop being available to any other school — which is why a wrong pick can make the next order look short when it is not.',
      'A pick is all or nothing. There is no half-picked state, because a partial reservation would let the ledger claim stock is committed to an order nobody finished. If you picked the wrong order, use Undo on the order itself; it puts the stock back and records why.',
      'Despatch is per school, not per order. One van carries every order for that school that is ready, and the packing list names the student on each line so the school can hand parcels to the right child.',
      'Once a van has gone it cannot be recalled. An order that turns out to be wrong comes back as a return, not by undoing the despatch.',
      'Shipped and Delivered are different. Shipped means it left the warehouse; Delivered means the school confirmed it arrived. Anything sitting between those for more than a fortnight appears on the leads’ dashboard as a parcel worth chasing.',
    ],
  },
  {
    path: '/receiving',
    title: 'Receiving from a Tailoring Center',
    points: [
      'Tailoring Centers do not use this system. The packing list arrives on paper with the goods and a warehouse clerk keys it in, which is why the packing list number is free text.',
      'What arrived and what the paper claims are recorded separately and never averaged. The difference is the thing you are here to resolve.',
      'Entering a receipt does not change stock. Posting it does, as a deliberate second step, so a delivery can be counted and checked before anything is committed.',
      'Posting cannot be undone. The stock ledger only ever adds entries, so a miscount is corrected with an inventory adjustment, not by editing the receipt.',
    ],
  },
  {
    path: '/group-orders',
    title: 'Group orders',
    points: [
      'A group order is the season\u2019s whole requirement across all three Tailoring Centers \u2014 AsOne\u2019s own words: the consolidated total, used to initially fund them. One document per season, not one per site.',
      'Production orders break it down: each warehouse ordering its share from a centre. AsOne\u2019s spec says they should initially sum up to the group order, and the Requirement vs Ordered table on each one is that comparison.',
      'A negative difference means the centres have been asked for less than the requirement. It is reported, never blocked \u2014 a warehouse ordering a little extra for safety stock is a judgement call, and refusing it would refuse the decision too.',
      'Every line is priced from the list in force on the order date, and fixed there. Unlike a production order there is no negotiated price, because the centres have not been asked yet \u2014 so a garment with no price on that date refuses the whole order rather than costing it at zero.',
      'Only the leads raise or cancel one. Finance reads it; the warehouse and schools never see it. Cancelling is a status change, never a delete \u2014 the document is what funded the centres.',
    ],
  },
  {
    path: '/group-orders/new',
    title: 'Creating a group order',
    points: [
      'Record the season\u2019s total requirement here, before the Tailoring Centers are asked for their share of it.',
      'There is no price column. The server prices every line from the list in force on the order date, so a garment with no price on that date has to be priced first \u2014 on Inventory \u2192 Garments. The form names which ones.',
      'A garment may appear once. Chosen ones drop out of the picker rather than being caught when you submit.',
      'A line with no garment chosen blocks the order rather than being quietly dropped. Posting forty of forty-one lines and reporting success would surface months later as a production order nobody can reconcile.',
    ],
  },
  {
    path: '/production-orders',
    title: 'Production orders',
    points: [
      'A production order asks a Tailoring Center to make garments for a warehouse. Any centre can supply any warehouse — the primary centre is a default, not a restriction.',
      'Line prices come from the price list in force on the order date. Type a price only where one was negotiated; a garment with no price on that date is refused rather than costed at zero.',
      'The status shows what has actually arrived: awaiting delivery, partially received, received. It cannot show what a centre is doing, because nobody at a centre types anything into this system.',
      'Only the leads raise a production order. The warehouse reads the queue and receives against it.',
    ],
  },
  /*
    Transfers has its own topic at its own path. It used to live under
    /adjustments/transfers and rely on longest-prefix matching to get the
    right notes; it is a top-level destination now, so the two no longer
    overlap at all.
  */
  {
    path: '/kits',
    title: 'Uniform Kits',
    points: [
      'A kit is a bundle a school orders as one line instead of five \u2014 a starter kit, say. It is a convenience for ordering and nothing more.',
      'No warehouse ever holds a kit. The moment one is ordered it becomes its component items, and picking, packing, shipping and the ledger all work from those. That is why a kit has no stock level.',
      'The price is the sum of its components at today\u2019s prices. A kit has no price of its own and no bundle discount, so repricing a garment changes every kit containing it the same day.',
      '\u201cCannot be priced\u201d means a component has no price on today\u2019s list, or the kit is empty. It is not zero, and a school cannot order it until the gap is filled.',
      'A kit belongs to one school level. A Primary kit cannot contain a High-School-only garment, so the picker only offers what fits.',
      'Kits are deactivated, never deleted. An inactive kit cannot be added to a new order; orders already placed are unaffected and reports still name it.',
      'Only the leads build kits. Schools and Finance read them.',
    ],
  },
  {
    path: '/transfers',
    title: 'Warehouse Transfers',
    points: [
      'A transfer moves stock between two AsOne warehouses. Nothing is bought or sold, so the total value of inventory is the same before and after — only its location changes.',
      'Not the same as a backorder transfer. There, one warehouse takes over another warehouse\u2019s order and ships direct to the school; no goods pass between warehouses at all.',
      'Avail at Source is what that warehouse currently shows. A line asking for more than it holds is refused, and it is checked again when the transfer posts, because stock moves in between.',
      'Posting writes two ledger rows for every line \u2014 one out, one in, at the same unit value. It happens in one transaction, because a half-posted transfer would make the goods vanish.',
      'Prepared means the transfer is written down but nothing has moved yet. Only posting moves stock.',
      'Both leads can raise a transfer, not only Finance \u2014 F25 is wider than the adjustment screens beside it.',
    ],
  },
  {
    path: '/adjustments',
    title: 'Inventory Adjustments',
    points: [
      'This is the only place a stock figure changes with no physical event behind it. Everywhere else the number moves because a delivery arrived, an order was picked, or a van left.',
      'Finance only. AsOne\u2019s access matrix reserves adjustments for the Finance Department \u2014 neither lead can post one, and nor can the warehouse that does the counting. That is their open question, not an oversight here.',
      'Nothing is edited and nothing is deleted. A wrong adjustment is corrected by posting the opposite entry, so both stay in the audit trail forever.',
      'The reason code decides the direction, not the person posting. You type a count; whether it adds or removes comes from the code.',
      'Inventory Correction works differently from the rest. You enter what was actually counted and the system works out the difference itself \u2014 that is the whole point of it, so nobody counting has to do the subtraction.',
      'Reason codes are master data the leads maintain. If the code you need is missing, it has to be added there, not here.',
      'Search and Type narrow the page you are looking at. Date Range and Warehouse are applied to the whole history.',
    ],
  },
  {
    path: '/backorders',
    title: 'Backorders',
    points: [
      'If a warehouse cannot fill every line of a paid order, nothing ships. The order is held whole until stock arrives or somebody hands it to a warehouse that has it. There is no part-shipping \u2014 a school never gets a parcel with half the uniform in it.',
      'That is why one missing shirt holds the trousers too, and why this queue lists orders rather than garments.',
      'Oldest first. That is the rule, not a default: it is the sequence the schools placed them in. Working down from the top is what the pack asks the warehouse to do.',
      'Nothing here is created or resolved. An order appears when it is paid for and short, and leaves on its own the moment stock arrives \u2014 there is no status to set and nothing to tidy up.',
      'Waiting on shows every line that is short, and by how much. That is the decision: wait for the next delivery, or move the order.',
      'Transfer hands the order to a warehouse that holds enough of every line. Only those warehouses are listed, because a site that could fill some of it would only leave the order waiting in a second place.',
      'A transfer moves responsibility, not goods. No stock is reserved anywhere; the receiving warehouse picks in the ordinary way and ships direct to the school. The school keeps its own warehouse for everything it orders next.',
      'Refusals say why in plain words, with the numbers \u2014 which line, how many are needed, how many are there. Read them rather than retrying.',
    ],
  },
  {
    path: '/reports',
    title: 'Reports',
    points: [
      'Figures are shown as at the date you choose, not as at today. Change the date and every number on the page moves with it.',
      'Stock is valued at what was paid for it, not at today’s price list — so a report for last term still says what that term cost.',
      'Costed reports are for the leads and Finance. A warehouse sees the operational reports without the money.',
    ],
  },
  {
    path: '/schools',
    title: 'Schools',
    points: [
      'A school orders from one warehouse and no other. A backorder may still be filled by a different warehouse shipping direct, but that is a fulfilment decision made afterwards.',
      'A school orders from its own level. A primary school cannot order a high-school garment, the same rule its price list follows.',
      'Nothing here is deleted. A school that closes is deactivated, because every order it ever placed still points at it.',
    ],
  },
  {
    path: '/warehouses',
    title: 'Warehouses',
    points: [
      'Stock lives at a warehouse and moves by recorded transactions only — receipts, picks, shipments, transfers and adjustments. Nobody types a stock level.',
      'A warehouse clerk sees their own site. The leads and Finance see every site and can switch between them.',
      'Sites are deactivated, never deleted: every transaction that happened here still points at this record.',
    ],
  },
  {
    path: '/tailoring-centers',
    title: 'Tailoring Centers',
    points: [
      'Centres make the garments and are not users of this system. They exist here so production orders and receipts have something to point at.',
      'A centre supplies any warehouse. Its card shows what it has been asked for and how much has arrived.',
    ],
  },
  {
    path: '/inventory',
    title: 'Inventory',
    points: [
      'One row per SKU per warehouse. The same shirt in two warehouses is two rows, because stock is held at a site and never as one national figure.',
      'The table lists every SKU, not only the ones holding stock \u2014 so a new SKU appears here the moment it is created, before anything has arrived.',
      'Available is what can be promised to a new order. Pick is already reserved for an order somebody is picking, and Shipped has left the building — neither is available, which is why Available can read 0 while the shelf is not empty.',
      'A dash is not a zero. A dash means nothing has ever moved for that SKU at that warehouse; 0 means stock came in and has since gone out. A SKU that has never arrived and one that sold out are different situations, and the screen says which.',
      'Value is the stock on hand priced at what it was carried in at, so it follows Available exactly \u2014 both dashes clear together the moment the first stock arrives. It is never the current price list; it is what this stock actually cost.',
      'You cannot type a quantity into this table. Stock is a ledger: every arrival, pick, shipment and correction is its own row, and the level you see is those rows added up as you look. Nothing is ever overwritten, which is why Stock History can always show how a figure got to where it is.',
      'Four things put stock on a shelf, and every one of them writes a movement: Receiving a delivery from a Tailoring Center; an Inventory Adjustment posted by Finance with a reason code; Import stock count on this screen; and a Stock Transfer in from the other warehouse.',
      'To fill an empty row the usual way is Receiving \u2014 enter the delivery, then post it. Nothing moves until it is posted, so a receipt can be written down and checked against the shelf first.',
      'Import stock count is the quickest way to put real numbers against many SKUs at once. It takes a file of SKU, Warehouse and Counted, works out the difference from what the system thinks, and posts an adjustment for it. It only ever counts SKUs that already exist \u2014 it never creates one.',
      'A quantity turns amber once it is at or below that warehouse\u2019s minimum. The minimum is set per warehouse, because the two serve different numbers of schools.',
      'Low stock only narrows to exactly those rows. It filters what has already loaded rather than asking the server again, so it is instant and it respects the other filters.',
      'The table scrolls sideways \u2014 Status and Value sit past the right-hand edge on a narrow window.',
      'Clicking a row opens that SKU beside the table: its stock at every warehouse, its value, and the last movements against it. Those movements are the ledger, so they are the record rather than a summary.',
      'Create New SKU builds one garment in one size. The SKU number is never typed \u2014 the system composes it from the garment and the size, and shows it in the dialogue before you save.',
      'That number reads UNI-NUR-CHS-XS-CHK: a fixed prefix, the class band, the garment\u2019s item code, the size, and the colour code. Four of the five come from the garment and the size you pick.',
      'A garment created before class bands existed carries neither a band nor a colour code, and its SKUs keep the shorter CHS-XS form. Numbers already issued never change \u2014 they are on shelf labels and pick lists \u2014 so filling the garment in affects its next SKU, not its existing ones.',
      'Export CSV writes out exactly the rows the filters have left, not the whole catalogue.',
    ],
  },
  {
    path: '/reports/price-list',
    title: 'Price Lists',
    points: [
      'The document a school orders from: every active garment on one level, at the price that applied on the date you choose. A garment marked for both levels appears on each list.',
      'The date matters. A price applies over a period rather than sitting on the garment, so this can print what a school was quoted in March as easily as what they pay today.',
      'A garment with no price on that date is left off entirely, never shown at zero — a line with no price is worse than no line on a document somebody buys from.',
      'Which is what the amber banner is for. It names every active garment missing from the list, because the omission is otherwise invisible: a garment simply stops being orderable and nobody is told.',
      'Always clear that banner before publishing. A school cannot order what is not on the list.',
      'Prices are set and changed from the Garments tab on Inventory — a change closes the old price on a date and opens a new one, so past invoices still reprint correctly.',
      'Export CSV writes the raw figures, not the formatted ones, so a spreadsheet can total them.',
    ],
  },
  {
    path: '/stock-history',
    title: 'Stock History',
    points: [
      'The ledger itself — every movement in and out of every warehouse you can see, newest first. Inventory says how much is there; this says how it got that way.',
      'Quantity is signed. Positive came into the warehouse, negative left it, and the colour follows the sign so a receipt and a pick never read alike.',
      'Value is what moved, not a gain or a loss. A pick takes 20 units out and they are still worth what they were worth — it is snapshotted from the document that caused the movement, never recalculated.',
      'Every filter is applied by the server, so an empty table means nothing matched in the whole ledger rather than nothing on this page. That is why there is a SKU picker here instead of a search box.',
      'The Document column names the paper behind the row — RC a receipt, SH a shipment, ADJ an adjustment, WT a transfer, SO a school order.',
      'Nothing here can be edited or deleted, by anybody, including through the API. Stock levels are summed from these rows, so changing one would rewrite history and today’s figure at the same time. A wrong movement is corrected by posting an offsetting one.',
      'It opens on the last 30 days. Widen the date range for older movement — the ledger keeps everything.',
    ],
  },
  {
    path: '/users',
    title: 'Users & Roles',
    points: [
      'A role decides what somebody sees. The Permissions tab is the whole matrix \u2014 seven things a role may do, five roles \u2014 and it is the same matrix the server enforces, not a picture of it.',
      'Warehouse staff belong to one warehouse and school staff to one school; the two leads and Finance belong to all sites. An account with a site-bound role and no site sees nothing, which is why that reads in red.',
      'Adding a user generates a password shown to you once. It is never emailed, so you pass it on yourself, and they must replace it before they can use the system.',
      'Somebody who has forgotten their password is fixed from their profile \u2014 open the row, then Set a new password. That signs them out everywhere.',
      'Accounts are deactivated, never deleted. Every receipt, pick and adjustment names the person who made it, and an account that vanished would take that trail with it.',
      'A request for access appears at the top of this list and stays until somebody approves or declines it. Nothing is created until you do.',
    ],
  },
  {
    path: '/stock-history',
    title: 'Stock History',
    points: [
      'Not built yet \u2014 this screen has no design.',
      'The movements behind it already exist. Every one is visible today on a SKU: open Inventory and click the row.',
    ],
  },
  {
    path: '/pricing',
    title: 'Pricing',
    points: [
      'Not built yet \u2014 this screen has no design.',
      'A price is dated, not a number on a product: it applied over a period. An invoice raised in March must still cost what March cost, so changing a price never rewrites an order already placed.',
      'Prices are set by the leads. Finance can read them but not change them, which surprises people \u2014 Finance owns what stock is worth, not what it sells for.',
    ],
  },
  {
    path: '/orders/new',
    title: 'Place an Order',
    points: [
      'One order is for one student, by name. The school is the customer \u2014 students have no accounts \u2014 so the name here is what the school uses to hand the right uniform to the right child when the parcel arrives.',
      'You can order a Uniform Kit, individual garments, or both on the same order. A kit becomes its component garments for the warehouse to pick, so a kit and the same items ordered separately arrive identically.',
      'Only garments on your own price list appear. A garment marked for the other school level is not offered, and one with no price on today is not offered either \u2014 if something is missing, it needs pricing, not searching for.',
      'The total updates as you add lines, at today\u2019s prices. That is the figure the invoice carries.',
      'Saving creates the order on Hold and gives it a number. That number is the invoice number \u2014 there is no second series \u2014 and it is what a parent quotes when they pay.',
      'Nothing reaches the warehouse until Finance confirms payment. Until then the order can still be cancelled; afterwards it cannot.',
    ],
  },
  {
    path: '/production-orders/new',
    title: 'Raise a Production Order',
    points: [
      'This is a warehouse\u2019s order on a Tailoring Centre: what to make, how many, and by when.',
      'Choose the Tailoring Centre, the warehouse the goods are for, and a due date. The warehouse matters \u2014 it is where the stock lands when the van arrives, and a clerk can only receive against orders for their own site.',
      'Add a line per SKU. The unit price is what AsOne has agreed to pay that centre, and it is what the stock is valued at in the ledger forever \u2014 not today\u2019s price list.',
      'Header and lines are written together. There is no half-saved order to find later.',
      'The order opens as Open and stays there while deliveries come in against it. Nobody sets it to Received \u2014 that is worked out from the receipts.',
      'Raise one when something is at or below its minimum. The Low Stock figure on your dashboard is the trigger this exists to answer.',
    ],
  },
  {
    path: '/adjustments/new',
    title: 'Post an Adjustment',
    points: [
      'Two different jobs on one screen. A count correction is for after a stock take; an adjustment with a reason code is for a return, damage or a loss.',
      'For a count correction you type only what was physically counted. The system compares that with what it believes is on hand and posts the difference itself \u2014 you never work out or type the difference, which is what stops it going in backwards.',
      'If the count matches, nothing is posted at all and it says so. No document is created, because nothing happened.',
      'For everything else, the reason code you pick carries the direction. \u201cDamaged\u201d can only reduce stock; \u201cReturn\u201d can only add. You choose a reason, not a sign.',
      'The figure shown before you type is what the ledger currently sums to. It is a moment ago\u2019s truth, and the server checks again at the instant you post.',
      'Posting is permanent. A wrong adjustment is corrected by posting an offsetting one, never by editing or deleting \u2014 both are refused, by the server as well as by this screen.',
    ],
  },
  {
    path: '/transfers/new',
    title: 'Move Stock Between Warehouses',
    points: [
      'A transfer moves stock from one warehouse to another. Nothing is bought or sold, so total inventory value is identical before and after \u2014 only its location changes.',
      'It writes two ledger rows, one out of the sending site and one into the receiving one, at the value the stock is already carried at. Moving stock never revalues it.',
      'You cannot send more than the sending warehouse actually has available. Stock already reserved for an order somebody is picking is not available to move.',
      'Use this when one site is short and the other is not \u2014 it is usually faster than waiting for a Tailoring Centre.',
      'If a whole school order is what is short, transferring the order to the other warehouse is often better than moving the stock. That is on the Backorders screen.',
    ],
  },
  {
    path: '/kits/new',
    title: 'Build a Uniform Kit',
    points: [
      'A kit is a bundle a school can order as one line \u2014 \u201cPS Starter Kit\u201d rather than six separate garments.',
      'Give it a number and a name, say which school level it is for, then add each component SKU and how many of it the kit contains.',
      'A kit belongs to one school level and appears on that price list only. Unlike a garment, there is no \u201cboth\u201d.',
      'You never type a price. A kit is worth the sum of its components at their price on the day, calculated every time \u2014 so it can never drift out of step with the garments in it.',
      'Which means a kit cannot be priced at all until every component has a price. One unpriced garment keeps the whole kit off the price list, and the Price Lists report names which.',
      'Ordering a kit creates demand for its component SKUs. The warehouse picks garments, never kits.',
    ],
  },
  {
    path: '/reports/inventory',
    title: 'Inventory Report',
    points: [
      'Stock on hand across every warehouse you can see, with what it is worth.',
      'Set a date to see the position as it was then. The figures are summed from the ledger, so a past date is a real answer rather than an estimate.',
      'Value is Available stock at unit value. Stock reserved for an order being picked is not counted \u2014 worth knowing before comparing this with a shelf.',
      'Filtering by SKU narrows the table, the totals and the export together, so the CSV always matches what you are looking at.',
      'Export CSV writes the unrounded figures, so a spreadsheet can total them.',
    ],
  },
  {
    path: '/reports/procurement-costs',
    title: 'Procurement Costs',
    points: [
      'Two figures over the same period: what was committed to the Tailoring Centres on group orders, and what they actually delivered.',
      'They are shown side by side and deliberately not subtracted. A production order does not need a group order behind it \u2014 reorders through the year have none \u2014 so receipts routinely exceed group-order value and the difference would mean nothing.',
      'Everything is priced at the day it was agreed, never at today\u2019s price list. Stock is worth what was paid for it.',
      'Received is valued at what was counted in, not what the order asked for or the packing list claimed. A short delivery is worth less, and that shows here.',
      'Cancelled group orders are excluded by default \u2014 a withdrawn commitment is not a cost. The toggle includes them when the question is what was cancelled.',
      'Leave both dates empty for everything on record. Unlike a stock figure, a cost report opens on the whole history rather than a recent window.',
    ],
  },
  {
    path: '/shipments/history',
    title: 'Despatched Shipments',
    points: [
      'Every van that has left, newest first. This is a record \u2014 nothing is sent from here.',
      'To load a van, use the To Pick tab. Vans are despatched from there, one per school, carrying every order of that school\u2019s that is picked.',
      'In Transit means it left the warehouse and the school has not yet confirmed it arrived. Delivered means they have.',
      'Anything sitting In Transit for a long time is the point of this screen. A parcel that never arrived looks exactly like one that did until somebody confirms it.',
      'Only the receiving school can confirm a delivery. The warehouse cannot do it on their behalf \u2014 that would defeat the check.',
      'Opening a shipment shows what was on it and lets you print the packing list that travelled with the goods.',
    ],
  },
  {
    path: '/profile',
    title: 'My Profile',
    points: [
      'Your own record \u2014 your name, the address you sign in with, and how to reach you. Everybody has one.',
      'Changing your email changes where your sign-in code is sent as well as what you sign in with. They are the same address.',
      'Your role and your site are shown but cannot be changed here, by anybody \u2014 the server refuses it outright, not just this screen.',
      'A Program Lead or Operations Manager changes a role or a site, from Users & Roles. Nobody changes their own, including them: that is the separation working, not a missing button.',
      'Save appears once you have actually changed something, so there is no button that does nothing.',
      'This is not Settings. Settings is organisation-wide configuration everyone can read; this is only about you.',
    ],
  },
  {
    path: '/settings',
    title: 'Settings',
    points: [
      'Two tabs. System Settings is one document \u2014 change anything, then Save Settings commits the whole screen and Discard Changes puts it all back.',
      'Only a Program Lead or Operations Manager can change any of it. Everyone else sees the same screen read-only, because the organisation name is worth being able to look up.',
      'Organization Name is the name shown in the sidebar. Changing it changes it for everybody.',
      'Default Minimum pre-fills the figure when a new SKU is created. It does not change a minimum already set \u2014 those are per SKU per warehouse, and are edited from the SKU itself.',
      'Anything under an amber note is stored but not acted on. Nothing reads the printing preferences or the automatic-reorder fields today: they save and read back correctly, and that is all they do.',
      'System Alerts are the exception. Those three take effect the moment they save, for everyone \u2014 turning one off removes that kind of alert from every dashboard and every bell in the organisation.',
      'There is no Synchronization panel, although the design draws one. AsOne chose online-only working: a site without internet waits for it to come back rather than queueing data to sync later.',
    ],
  },
  {
    path: '/settings',
    tab: 'reason-codes',
    title: 'Adjustment Reason Codes',
    points: [
      'A reason code is the \u201cwhy\u201d on a stock adjustment. When Finance corrects a count, takes returned goods back into stock or writes off damage, they pick one of these.',
      'It stays on that movement permanently. Months later the stock history can still say what happened and who decided it \u2014 which is the whole reason the table exists.',
      'The code carries the direction, not the person posting. Each one either adds to stock or removes from it, so nobody ever types a minus sign: choosing \u201cDamaged\u201d can only ever reduce stock.',
      'That is what stops an adjustment going in backwards \u2014 the commonest and least visible mistake in stock keeping.',
      'Which is why the effect cannot be changed once a code is saved. Flipping it would reverse the meaning of every adjustment already posted against it, including last year\u2019s.',
      'A code set up the wrong way is retired and replaced, never corrected. Retiring takes it out of the choices for new adjustments and leaves it on every one already posted.',
      'Nothing here is ever deleted, and the server refuses to as well. An audit trail that cannot say why a movement happened is not an audit trail.',
      '\u201cWhen to use it\u201d is optional and worth filling in \u2014 it is the only guidance the person choosing a code will see.',
      'Only a Program Lead or Operations Manager can add or retire a code. Finance, who actually post the adjustments, read this table but do not maintain it.',
    ],
  },
] as const

/**
 * The topic for a path, by longest matching prefix.
 *
 * Longest wins so a detail route falls back to its list’s topic rather than
 * to nothing — `/orders/24` is still about orders.
 */
export function helpFor(pathname: string, tab?: string | null): HelpTopic | null {
  /*
   * A screen whose tabs are genuinely different subjects gets a topic each,
   * keyed on the `?tab=` the screen already puts in the URL. Settings is the
   * case that needed it: system configuration and the reason-code table share
   * a route and have nothing else in common, so one help entry covering both
   * would be two unrelated explanations stapled together.
   *
   * Checked before the prefix match, and only when a topic actually declares
   * a tab — every other screen is unaffected.
   */
  if (tab) {
    const forTab = HELP_TOPICS.find(
      (topic) => topic.tab === tab && pathname.startsWith(topic.path),
    )
    if (forTab) return forTab
  }

  const matches = HELP_TOPICS.filter(
    (topic) => topic.tab === undefined && pathname.startsWith(topic.path),
  )
  if (matches.length === 0) return null

  return matches.reduce((best, topic) =>
    topic.path.length > best.path.length ? topic : best,
  )
}
