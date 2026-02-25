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
      toastClassName={() => 'shadow-none bg-transparent border-none p-0 m-0'}
      bodyClassName={() => 'p-0 m-0'}
      style={{ zIndex: 9999 }}
    />
  );
}
