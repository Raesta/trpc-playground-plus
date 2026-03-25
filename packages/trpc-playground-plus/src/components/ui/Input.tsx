import { theme } from '../../theme';

interface InputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  disabled?: boolean;
}

const styles: Record<string, React.CSSProperties> = {
  input: {
    flex: 1,
    backgroundColor: theme.colors.bg.root,
    color: theme.colors.text.primary,
    border: `1px solid ${theme.colors.border.primary}`,
    padding: '0 8px',
    height: '30px',
    borderRadius: theme.radius.sm,
    fontSize: theme.font.size.md,
    outline: 'none',
    transition: `border-color ${theme.transition.fast}`,
  }
}

const Input = ({ value, onChange, placeholder, type = 'text', disabled = false }: InputProps) => {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={{ ...styles.input, ...(disabled ? { opacity: 0.4, cursor: 'not-allowed' } : {}) }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = theme.colors.accent.primary;
        e.currentTarget.style.boxShadow = `0 0 0 2px ${theme.colors.border.focus}`;
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = theme.colors.border.primary;
        e.currentTarget.style.boxShadow = 'none';
      }}
    />
  )
}

export default Input;