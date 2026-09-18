/**
 * A primary action with its rarer siblings behind a caret.
 *
 * Four buttons across a page head is too many, but folding them all into one
 * menu buries the action people actually came for. A split button keeps the
 * common one a single click and puts the occasional ones one click deeper:
 * Create New SKU stays visible, New garment and New size live in the caret.
 *
 * ---------------------------------------------------------------------------
 * Why this is hand-built rather than a library
 * ---------------------------------------------------------------------------
 * It needs four behaviours and no more: open on click, close on Escape,
 * close on a click elsewhere, and close after choosing. That is a `useEffect`
 * and a `<ul>`. What it must not do is trap focus or render in a portal —
 * this sits in a page head, not over the page.
 *
 * `onPointerDown` rather than `onClick` for the outside-click listener: a
 * click that starts inside the menu and ends outside it is still a click on
 * the item, and closing on pointer-down keeps the two in step.
 */

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

export interface SplitButtonOption {
  label: string
  onSelect: () => void
  /** Shown but not choosable — an option this role may not use. */
  disabled?: boolean
  /** One line under the label, for an option whose name is not enough. */
  hint?: string
}

interface SplitButtonProps {
  /** The primary action: its own button, always one click. */
  children: ReactNode
  onClick: () => void
  options: SplitButtonOption[]
  variant?: 'primary' | 'secondary'
  /** Names the caret for a screen reader — "More create options". */
  menuLabel: string
  disabled?: boolean
}

export function SplitButton({
  children,
  onClick,
  options,
  variant = 'primary',
  menuLabel,
  disabled = false,
}: SplitButtonProps) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    function onPointerDown(event: globalThis.PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  return (
    <div className="split" ref={root}>
      <button
        type="button"
        className={`btn btn--${variant} split__main`}
        onClick={onClick}
        disabled={disabled}
      >
        {children}
      </button>

      <button
        type="button"
        className={`btn btn--${variant} split__caret`}
        aria-label={menuLabel}
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        disabled={disabled}
      >
        <ChevronDown size={16} aria-hidden />
      </button>

      <ul className="split__menu" id={menuId} role="menu" hidden={!open}>
        {options.map((option) => (
          <li key={option.label} role="none">
            <button
              type="button"
              role="menuitem"
              className="split__item"
              disabled={option.disabled}
              onClick={() => {
                setOpen(false)
                option.onSelect()
              }}
            >
              <span>{option.label}</span>
              {option.hint && <small className="split__hint">{option.hint}</small>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
