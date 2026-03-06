'use client';

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export function ToastProvider() {
  return (
    <ToastContainer
      position="bottom-right"
      autoClose={5000}
      hideProgressBar={true}
      closeOnClick
      pauseOnHover
      draggable
      theme="light"
      style={{ zIndex: 9999 }}
    />
  );
}
