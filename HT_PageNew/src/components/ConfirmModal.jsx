import React from 'react';
import Modal from './Modal';
import { AlertTriangle } from 'lucide-react';

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title || 'Xác nhận xóa'}>
      <div className="modal-body" style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.15)',
            color: '#f87171',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem auto',
            border: '1px solid rgba(239, 68, 68, 0.3)'
          }}
        >
          <AlertTriangle size={28} />
        </div>
        <p style={{ color: 'var(--text-main)', fontSize: '0.95rem', fontWeight: 500 }}>
          {message || 'Bạn có chắc chắn muốn xóa mục này không? Hành động này không thể hoàn tác.'}
        </p>
      </div>

      <div className="modal-footer" style={{ justifyContent: 'center' }}>
        <button onClick={onClose} className="btn btn-secondary" style={{ width: '110px' }}>
          Hủy
        </button>
        <button onClick={onConfirm} className="btn btn-danger" style={{ width: '110px' }}>
          Xóa ngay
        </button>
      </div>
    </Modal>
  );
}
