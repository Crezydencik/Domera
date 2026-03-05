import React from 'react';

interface Tab {
  label: string;
  value: string;
}

interface TabsHeaderProps {
  tabs: Tab[];
  active: string;
  onChange: (value: string) => void;
}

export default function TabsHeader({ tabs, active, onChange }: TabsHeaderProps) {
  return (
    <div className="flex gap-2 bg-white rounded-t-xl px-2 pt-2 border-b border-gray-200">
      {tabs.map(tab => (
        <button
          key={tab.value}
          className={`px-5 py-2 rounded-t-lg font-medium text-sm transition-all
            ${active === tab.value
              ? 'bg-white border-b-2 border-black text-black shadow-sm'
              : 'bg-transparent text-gray-600 hover:bg-gray-100'}
          `}
          style={{ outline: 'none' }}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
