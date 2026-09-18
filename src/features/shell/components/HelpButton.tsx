/**
 * The Help control in the top bar.
 *
 * Context help: it explains **the screen you are on**, not the system in
 * general. This system refuses things for reasons a person cannot guess from
 * the interface — an order that will not pick because Finance has not
 * confirmed payment, a backorder offering View TC instead of Release — and a
 * refusal you cannot explain reads as a bug.
 *
 * The button was previously wired to nothing at all, which is worse than
 * absent: people press it, nothing happens, and they stop trusting the other
 * controls.
 *
 * Content lives in `help.ts` as plain data, so it can be reviewed and
 * corrected by somebody who does not read code — and kept in step as screens
 * change.
 */

import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { HelpCircle } from 'lucide-react'
import { Modal } from '@/components'
import { helpFor } from '../help'

export function HelpButton() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const topic = helpFor(pathname)

  return (
    <>
      <button
        type="button"
        className="topbar__icon-btn"
        aria-label={topic ? `Help with ${topic.title}` : 'Help'}
        onClick={() => setOpen(true)}
      >
        <HelpCircle size={18} aria-hidden />
      </button>

      <Modal
        open={open}
        size="md"
        className="modal--help"
        title={topic ? topic.title : 'Help'}
        subtitle={topic ? 'How this screen works' : undefined}
        onClose={() => setOpen(false)}
      >
        {topic ? (
          <ul className="help__list">
            {topic.points.map((point) => (
              <li className="help__point" key={point}>
                {point}
              </li>
            ))}
          </ul>
        ) : (
          /*
            A screen with no entry yet says so plainly rather than showing an
            empty panel — and names where the notes live, because the person
            reading this is the one who can add them.
          */
          <p className="help__none">
            There are no notes for this screen yet. If something here is not
            obvious, it is worth writing down — ask ERA 92 to add it.
          </p>
        )}
      </Modal>
    </>
  )
}
