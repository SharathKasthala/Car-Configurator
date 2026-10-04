import { Modal as BsModal } from 'react-bootstrap'

// Reusable popup (Bootstrap modal) with a title and close button
export default function Modal({ title, onClose, children, wide }) {
  return (
    <BsModal show onHide={onClose} centered scrollable size={wide ? 'xl' : undefined}>
      <BsModal.Header closeButton>
        <BsModal.Title as="h2" className="h5">{title}</BsModal.Title>
      </BsModal.Header>
      <BsModal.Body className="d-flex flex-column gap-3">{children}</BsModal.Body>
    </BsModal>
  )
}

// Row of buttons at the bottom of a popup
export function ModalActions({ children }) {
  return <div className="d-flex flex-wrap justify-content-end align-items-center gap-2">{children}</div>
}
