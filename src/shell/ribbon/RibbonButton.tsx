import React from 'react';

interface RibbonButtonProps {
  title: string;
  label?: string;
  icon?: React.ReactNode;
  large?: boolean;
  pressed?: boolean;
  disabled?: boolean;
  keyTip?: string;
  onClick?: () => void;
}

/** Compact icon button, or a tall primary control with the label under the icon. */
export const RibbonButton: React.FC<RibbonButtonProps> = ({
  title,
  label,
  icon,
  large = false,
  pressed = false,
  disabled = false,
  keyTip,
  onClick,
}) => {
  return (
    <button
      type="button"
      title={title}
      aria-label={label ? undefined : title}
      aria-pressed={pressed || undefined}
      disabled={disabled}
      onClick={onClick}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: large ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: large ? 2 : 4,
        minWidth: large ? 58 : undefined,
        height: large ? 68 : 28,
        padding: large ? '4px 8px' : label ? '4px 8px' : 4,
        borderRadius: 4,
        backgroundColor: pressed ? 'var(--folio-teal-light)' : 'transparent',
        color: 'var(--folio-ink)',
        opacity: disabled ? 0.35 : 1,
        fontSize: 11,
        fontWeight: 500,
        lineHeight: 1.15,
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {label ? <span>{label}</span> : null}
      {keyTip && (
        <span
          data-testid={`keytip-command-${keyTip}`}
          style={{
            position: 'absolute',
            bottom: -6,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            fontSize: 10,
            fontWeight: 700,
            padding: '1px 5px',
            borderRadius: 3,
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            pointerEvents: 'none',
            zIndex: 1200,
            lineHeight: 1.2,
          }}
        >
          {keyTip}
        </span>
      )}
    </button>
  );
};

export const ribbonFieldStyle: React.CSSProperties = {
  height: 28,
  padding: '2px 6px',
  borderRadius: 4,
  border: '1px solid var(--folio-border)',
  background: '#fff',
  color: 'var(--folio-ink)',
  fontSize: 12,
  outline: 'none',
};
