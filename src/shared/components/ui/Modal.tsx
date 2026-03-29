
"use client";
import React from 'react';
import ReactDOM from 'react-dom';


interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  overlayClassName?: string;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, overlayClassName }) => {
  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center ${overlayClassName ?? ''}`}
      style={!overlayClassName ? { background: 'rgba(247, 248, 250, 0.85)' } : undefined}
    >
      <div className="bg-white rounded-lg shadow-lg p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
        {children}
      </div>
    </div>,
    document.body
  );
};