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
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button 
        type="button" 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full text-left bg-[#0f0f11] ${STITCH_CLASS} transition-colors rounded-none flex flex-col gap-0.5 justify-center pb-2 pl-3 pr-1 pt-1.5 select-none focus:outline-none`}
      >
        <p className="text-[8px] font-black text-[#c2a35d] uppercase tracking-widest">{label}</p>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-white/90">{value}</span>
          <span className={`material-symbols-outlined text-[16px] text-[#c2a35d] mr-1 transition-transform ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
        </div>
      </button>
      {isOpen && (
        <div className="absolute z-50 top-[calc(100%+4px)] left-0 w-full bg-[#0f0f11] border border-white/10 rounded-none overflow-hidden shadow-2xl animate-dropdown origin-top">
          <div className="max-h-48 overflow-y-auto dark-scrollbar">
            {options.map((opt) => (
              <button 
                key={opt} 
                type="button"
                className={`w-full text-left px-3 py-3 text-[11px] font-medium tracking-tight hover:bg-white/5 transition-colors ${value === opt ? 'bg-[#c2a35d] text-black' : 'text-white/60'}`}
                onClick={() => { onChange(opt); setIsOpen(false); }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
export const TextInput: React.FC<{
  value: string; 
  onChange: (val: string) => void; 
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, placeholder, className = '' }) => (
  <textarea 
    value={value} 
    onChange={(e) => onChange(e.target.value)} 
    placeholder={placeholder}
    className={`bg-[#0f0f11] ${STITCH_CLASS} rounded-none w-full h-[100px] px-3 py-3 resize-none text-[11px] font-medium text-white placeholder-white/10 focus:outline-none focus:border-white/30 transition-colors ${className}`} 
  />
);
export const SegmentedToggle: React.FC<{
  value: string; 
  items: { value: string; label: string; icon?: React.ReactNode }[];
  onChange: (val: any) => void;
}> = ({ value, items, onChange }) => (
  <div className="flex w-full items-center p-1 bg-black/60 border border-white/5 rounded-none">
    {items.map((item) => (
      <button 
        key={item.value} 
        type="button" 
        onClick={() => onChange(item.value)}
        className={`flex-1 flex items-center justify-center gap-1 h-[40px] px-1 rounded-none text-[9px] font-bold uppercase tracking-widest transition-all ${
          value === item.value ? 'bg-[#c2a35d] text-black shadow-lg' : 'text-white/30 hover:text-white/50'
        }`}
      >
        {item.icon}<span>{item.label}</span>
      </button>
    ))}
  </div>
);
export const Checkbox: React.FC<{
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className="flex items-center gap-3 group cursor-pointer select-none py-1"
  >
    <div className={`w-4 h-4 rounded-none border flex items-center justify-center transition-all ${
      checked ? 'bg-[#c2a35d] border-[#c2a35d]' : 'border-white/10 group-hover:border-white/30'
    }`}>
      {checked && <span className="material-symbols-outlined text-[12px] text-black font-black">check</span>}
    </div>
    <span className="text-[10px] font-medium text-white/50 uppercase tracking-wide group-hover:text-white/80 transition-colors">{label}</span>
  </button>
);
