import React from "react";

interface ConsentCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
}

export const ConsentCheckbox: React.FC<ConsentCheckboxProps> = ({ checked, onChange, error }) => {
  const policies = [
    {
      href: "/privat-policy",
      label: "privātuma politikai"
    },
    {
      href: "/term",
      label: "lietošanas noteikumiem"
    }
  ];

  return (
    <div style={{ margin: "1em 0" }}>
      <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          style={{ marginRight: 8 }}
        />
        <span>
          Es piekrītu&nbsp;
          {policies.map((policy, idx) => (
            <React.Fragment key={policy.href}>
              <a href={policy.href} target="_blank" rel="noopener noreferrer">{policy.label}</a>
              {idx === 0 && <>&nbsp;un&nbsp;</>}
            </React.Fragment>
          ))}
        </span>
      </label>
      {error && <div style={{ color: "red", fontSize: 12 }}>{error}</div>}
    </div>
  );
};
