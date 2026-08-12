import { useEffect } from 'react'

interface PixelConfirmDialogProps {
  title: string
  description: string
  confirmLabel: string
  danger?: boolean
  onCancel: () => void
  onConfirm: () => void
}

function PixelConfirmDialog({
  title,
  description,
  confirmLabel,
  danger = false,
  onCancel,
  onConfirm
}: PixelConfirmDialogProps): React.JSX.Element {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onCancel])

  return (
    <div
      className="pixel-confirm-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <section className="pixel-confirm-dialog" role="alertdialog" aria-modal="true">
        <p className="pixel-kicker">ARE YOU SURE?</p>
        <h2>{title}</h2>
        <p>{description}</p>
        <div className="pixel-confirm-actions">
          <button type="button" onClick={onCancel}>취소</button>
          <button type="button" className={danger ? 'danger' : 'confirm'} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}

export default PixelConfirmDialog
