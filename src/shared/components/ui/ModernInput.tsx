'use client';

import React, { InputHTMLAttributes, useState } from 'react';

export interface ModernInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  hint?: string;
  error?: string;
  success?: boolean;
  required?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  variant?: 'default' | 'filled' | 'outlined';
  inputSize?: 'sm' | 'md' | 'lg';
  showPasswordToggle?: boolean;
  loading?: boolean;
}

const ModernInput = React.forwardRef<HTMLInputElement, ModernInputProps>(
  (
    {
      label,
      hint,
      error,
      success = false,
      required = false,
      icon,
      iconPosition = 'left',
      variant = 'default',
      inputSize = 'md',
      type = 'text',
      showPasswordToggle = false,
      loading = false,
      className = '',
      disabled = false,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';

    const inputSizeClasses = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2.5 text-base',
      lg: 'px-5 py-3 text-lg',
    };

    const variantClasses = {
      default: `bg-white border-2 border-gray-200 hover:border-gray-300 focus:border-blue-500 
                ${error ? 'border-red-500 focus:border-red-500' : ''}
                ${success ? 'border-green-500 focus:border-green-500' : ''}`,
      filled: `bg-gray-100 border-0 hover:bg-gray-200 focus:bg-white focus:border-2 focus:border-blue-500
               ${error ? 'bg-red-50 focus:border-red-500' : ''}
               ${success ? 'focus:border-green-500' : ''}`,
      outlined: `bg-transparent border-2 border-gray-300 hover:border-gray-400 focus:border-blue-500
                 ${error ? 'border-red-500 focus:border-red-500' : ''}
                 ${success ? 'border-green-500 focus:border-green-500' : ''}`,
    };

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-semibold text-gray-800 mb-2.5">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        <div className="relative group">
          {icon && iconPosition === 'left' && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors pointer-events-none">
              {icon}
            </div>
          )}

          <input
            ref={ref}
            type={isPassword && showPasswordToggle ? (showPassword ? 'text' : 'password') : type}
            disabled={disabled || loading}
            className={`
              w-full rounded-lg font-medium transition-all duration-200
              text-gray-900 placeholder-gray-400
              focus:outline-none focus:ring-2 focus:ring-blue-200
              disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed
              ${inputSizeClasses[inputSize]}
              ${variantClasses[variant]}
              ${icon && iconPosition === 'left' ? 'pl-10' : ''}
              ${icon && iconPosition === 'right' && !isPassword ? 'pr-10' : ''}
              ${(isPassword && showPasswordToggle) || (icon && iconPosition === 'right') ? 'pr-10' : ''}
              ${className}
            `}
            {...props}
          />

          {/* Right icon or password toggle */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {loading && (
              <div className="animate-spin">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            )}

            {!loading && success && !error && (
              <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}

            {error && (
              <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18.101 12.93a1 1 0 00-1.414-1.414L10 15.586 3.313 8.899a1 1 0 00-1.414 1.414l8 8a1 1 0 001.414 0l8-8z" clipRule="evenodd" />
              </svg>
            )}

            {isPassword && showPasswordToggle && !loading && (
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                className="text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            )}

            {icon && iconPosition === 'right' && !isPassword && !loading && (
              <div className="text-gray-400 group-focus-within:text-blue-500 transition-colors pointer-events-none">
                {icon}
              </div>
            )}
          </div>
        </div>

        {/* Helper text */}
        {hint && !error && (
          <p className="text-xs text-gray-500 mt-1.5">{hint}</p>
        )}

        {error && (
          <p className="text-xs text-red-500 mt-1.5 font-medium">{error}</p>
        )}

        {success && !error && (
          <p className="text-xs text-green-500 mt-1.5">{typeof success === 'string' ? success : 'Success'}</p>
        )}
      </div>
    );
  }
);

ModernInput.displayName = 'ModernInput';

export default ModernInput;
