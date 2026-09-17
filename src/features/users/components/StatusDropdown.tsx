/**
 * Active/Deactivated as a dropdown, not a static label — the Users table's
 * Status column and the detail screen's banner both use this. Opening it
 * always offers both actions, "Activate" and "Deactivate", regardless of
 * the account's current state — both verbs, so neither reads as the
 * account's current state instead of a choice to make.
 *
 * Closes on an outside click or Escape, the same pattern `NotificationBell`
 * already uses for its panel.
 */

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface StatusDropdownProps {
  isActive: boolean
  pending?: boolean
  onActivate: () => void
  onDeactivate: () => void
}

export function StatusDropdown({ isActive, pending, onActivate, onDeactivate }: StatusDropdownProps) {
  const [open, setOpen] = useState(false)
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function choose(action: () => void) {
    setOpen(false)
    action()
  }

  return (
    <div className="status-dropdown" ref={container}>
      <button
        type="button"
        className={`status-dropdown__trigger status-dot status-dot--${isActive ? 'active' : 'inactive'}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={pending}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((shown) => !shown)
        }}
      >
        <span className="status-dot__mark" aria-hidden />
        {isActive ? 'Active' : 'Deactivated'}
        <ChevronDown size={14} aria-hidden />
      </button>

      {open && (
        <div className="status-dropdown__panel" role="listbox" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            role="option"
            aria-selected={isActive}
            className="status-dropdown__option status-dropdown__option--active"
            onClick={() => choose(onActivate)}
          >
            <span className="status-dot__mark status-dot__mark--active" aria-hidden />
            Activate
          </button>
          <button
            type="button"
            role="option"
            aria-selected={!isActive}
            className="status-dropdown__option status-dropdown__option--inactive"
            onClick={() => choose(onDeactivate)}
          >
            <span className="status-dot__mark" aria-hidden />
            Deactivate
          </button>
        </div>
      )}
    </div>
  )
}
