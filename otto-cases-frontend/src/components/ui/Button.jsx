import React from 'react';

export const Button = ({ children, onClick, variant = "primary", disabled = false, className = "", type = "button" }) => {
  const base = "px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300",
    secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50",
    outline: "border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300",
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};
