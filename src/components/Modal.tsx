/**
 * A modal dialog, on the native `<dialog>` element.
 *
 * Built on `<dialog>` because the platform already does the hard parts and
 * does them better: focus is trapped inside, the rest of the page goes inert
 * to a screen reader, Escape closes it, and the top layer means no stacking
 * context can put something over it.
 *
 * Two behaviours are deliberately overridden. **Escape is intercepted**
 * rather than allowed to close silently, so a half-typed form can ask first.
 * **The backdrop does not close it** — a misplaced click should not discard
 * what somebody was in the middle of.
 *
 * ## Why there are two elements and not one
 *
 * The `<dialog>` is the full viewport and paints nothing; the card inside it
 * is what you see. Centring is then `place-items: center` on a box of known
 * size, which cannot go wrong.
 *
 * The obvious version — style the `<dialog>` itself as the card and let the
 * browser centre it — is what this replaced, and it put every dialog against
 * the top of the screen. A dialog is centred by `margin: auto` against
 * `inset: 0`, and auto margins only centre an axis whose size is definite.
 * The height was `auto` behind a `max-height`, so the vertical margins
 * resolved to zero. Three attempts to state it more explicitly did not shift
 * it. This does not rely on that mechanism at all.
 */

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  title: string
  /** A line under the title, for a dialog that needs one. */
  subtitle?: string
  onClose: () => void
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
  /** Pinned below the scrolling body. */
  footer?: ReactNode
  className?: string
}

export function Modal({
  open,
  title,
  subtitle,
  onClose,
  size = 'sm',
  children,
  footer,
  className,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  // Unique, so two dialogs mounted at once cannot share an id.
  const titleId = useId()

  /*
   * Opening and closing genuinely has to be an effect: `showModal()` is an
   * imperative call into a DOM node, which is exactly the "synchronise with
   * an external system" an effect is for.
   */
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  if (!open) return null

  return (
    <dialog
      ref={ref}
      className="modal-host"
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Escape: let the owner decide rather than discarding silently.
        event.preventDefault()
        onClose()
      }}
    >
      <div className={`modal modal--${size}${className ? ` ${className}` : ''}`}>
        <header className="modal__head">
          <div>
            <h2 className="modal__title" id={titleId}>
              {title}
            </h2>
            {subtitle && <p className="modal__subtitle">{subtitle}</p>}
          </div>
          <button type="button" className="modal__close" aria-label="Close" onClick={onClose}>
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="modal__body">{children}</div>

        {footer && <footer className="modal__foot">{footer}</footer>}
      </div>
    </dialog>
  )
}
