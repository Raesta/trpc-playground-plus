interface InputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}

const styles: Record<string, React.CSSProperties> = {
  input: {
    backgroundColor: '#333',
    color: 'white',
    border: 'none',
    padding: '5px',
    borderRadius: '3px',
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
    />
  )
}

export default Input;