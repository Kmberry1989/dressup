import React, { useState, useRef, useEffect } from 'react';
// Elegant trim and fine stitching for the Gala theme
const STITCH_CLASS = "border border-white/10 shadow-[inset_0_0_15px_rgba(0,0,0,0.4)]";
export const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center px-3 py-1 bg-[#1a1a1c] border-l-2 border-[#c2a35d] mb-2 self-start shadow-sm">
    <span className="text-[9px] font-bold text-[#f5f5f7] tracking-[0.2em] uppercase">
      {children}
    </span>
  </div>
);
export const PillButton: React.FC<{
  icon?: React.ReactNode; 
  children: React.ReactNode;
  variant?: 'filled' | 'outline' | 'solid'; 
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}> = ({ icon, children, variant = 'filled', onClick, disabled, className = '' }) => {
  const base = 'flex items-center gap-2 justify-center w-full h-[44px] rounded-none font-bold tracking-[0.1em] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98]';
  
  const variants: Record<string, string> = {
    filled: `bg-[#252529] hover:bg-[#2d2d33] text-[#f5f5f7] ${STITCH_CLASS} text-[11px] uppercase`,
    outline: `border border-white/20 hover:bg-white/5 text-[11px] text-white/80 uppercase`,
    solid: `bg-[#c2a35d] hover:bg-[#d4b46e] text-black ${STITCH_CLASS} text-[12px] uppercase font-black`,
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} onClick={onClick} disabled={disabled}>
      {icon && <span className="flex items-center justify-center">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};
export const FieldDropdown: React.FC<{
  label: string; 
  value: string; 
  options: string[];
  onChange: (val: string) => void; 
  className?: string;
}> = ({ label, value, options, onChange, className = '' }) => {
