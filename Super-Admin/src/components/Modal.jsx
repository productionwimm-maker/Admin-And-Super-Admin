export default function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal ${wide ? 'wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="toolbar">
          <h2>{title}</h2>
          <button className="sm" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}
