import React from 'react';
import { useTheme } from '../../ThemeContext';

interface CheckboxProps {
  checked: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  id?: string;
  name?: string;
  className?: string;
  disabled?: boolean;
}

const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onChange,
  id,
  name,
  className,
  disabled
}) => {
  const theme = useTheme();

  const styles: Record<string, React.CSSProperties> = {
    containerStyles: {
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      margin: 0,
      padding: 0,
    },
    hiddenCheckboxStyles: {
      position: 'absolute',
      opacity: 0,
      cursor: disabled ? 'default' : 'pointer',
      height: 0,
      width: 0,
    },
    checkboxStyles: {
      position: 'relative',
      width: '24px',
      height: '24px',
      backgroundColor: checked ? theme.colors.accent.checkbox : theme.colors.bg.root,
      border: `1px solid ${checked ? theme.colors.accent.checkbox : theme.colors.border.secondary}`,
      borderRadius: theme.radius.sm,
      cursor: disabled ? 'default' : 'pointer',
      transition: `all ${theme.transition.normal}`
    },
    checkmarkStyles: {
      position: 'absolute',
      left: '8px',
      top: '3px',
      width: '6px',
      height: '12px',
      border: 'solid white',
      borderWidth: '0 2px 2px 0',
      transform: 'rotate(45deg)',
      display: checked ? 'block' : 'none'
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!disabled) {
      onChange(e);
    }
  };

  const handleClick = () => {
    if (!disabled) {
      const event = {
        target: { checked: !checked }
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(event);
    }
  };

  return (
    <div style={styles.containerStyles} className={className}>
      <input
        type="checkbox"
        id={id}
        name={name}
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
        style={styles.hiddenCheckboxStyles}
      />
      <div
        style={styles.checkboxStyles}
        onClick={handleClick}
        onMouseOver={(e) => {
          if (!disabled && !checked) {
            (e.currentTarget as HTMLDivElement).style.borderColor = theme.colors.accent.primary;
          }
        }}
        onMouseOut={(e) => {
          if (!disabled && !checked) {
            (e.currentTarget as HTMLDivElement).style.borderColor = theme.colors.border.secondary;
          }
        }}
      >
        <div style={styles.checkmarkStyles} />
      </div>
    </div>
  );
};

export default Checkbox;
