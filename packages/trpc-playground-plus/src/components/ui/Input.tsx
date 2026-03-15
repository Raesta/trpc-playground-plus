import { theme as t } from '../../theme';

interface InputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}

const styles: Record<string, React.CSSProperties> = {
  input: {
    backgroundColor: t.colors.bg.root,
    color: t.colors.text.primary,
    border: `1px solid ${t.colors.border.primary}`,
    padding: '0 8px',
    height: '30px',
    borderRadius: t.radius.sm,
    fontSize: t.font.size.md,
    outline: 'none',
    transition: `border-color ${t.transition.fast}`,
  }
}

const Input = ({ value, onChange, placeholder, type = 'text' }: InputProps) => {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={styles.input}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = t.colors.accent.primary;
        e.currentTarget.style.boxShadow = `0 0 0 2px ${t.colors.border.focus}`;
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = t.colors.border.primary;
        e.currentTarget.style.boxShadow = 'none';
      }}
    />
  )
}

export default Input;