import Checkbox from "./ui/Checkbox";
import Input from "./ui/Input";

interface HeadersProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  headers: { key: string; value: string; enabled: boolean }[];
  setHeaders: (headers: { key: string; value: string; enabled: boolean }[]) => void;
}

const Headers = ({ open, setOpen, headers, setHeaders }: HeadersProps) => {
  const addHeader = () => {
    setHeaders([...headers, {key: '', value: '', enabled: true}]);
  };

  const updateHeader = (index: number, field: 'key' | 'value' | 'enabled', newValue: string | boolean) => {
    const newHeaders = [...headers];

    if (field === 'key' || field === 'value') {
      newHeaders[index][field] = newValue as string;
    } else if (field === 'enabled') {
      newHeaders[index][field] = newValue as boolean;
    }

    setHeaders(newHeaders);
  };

  const removeHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index));
  };

  return (
    <>
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 9,
              animation: 'fadeIn 0.2s forwards'
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              height: '100%',
              backgroundColor: '#1a1a1a',
              borderLeft: '1px solid #333',
              padding: '10px',
              boxSizing: 'border-box',
              overflow: 'auto',
              zIndex: 10,
              animation: 'slideIn 0.3s forwards'
            }}
          >
            <h3 style={{ color: 'white', marginTop: 0 }}>Headers</h3>

            {headers.map((header, index) => (
              <div key={index} style={{ display: 'flex', marginBottom: '8px', gap: '5px' }}>
                <Checkbox
                  id={`header-enabled-${index}`}
                  checked={header.enabled}
                  onChange={() => updateHeader(index, 'enabled', !header.enabled)}
                />
                <Input
                  value={header.key}
                  onChange={(value) => updateHeader(index, 'key', value)}
                  placeholder="Key"
                />
                <Input
                  value={header.value}
                  onChange={(value) => updateHeader(index, 'value', value)}
                  placeholder="Value"
                />
                <button
                  onClick={() => removeHeader(index)}
                  style={{
                    backgroundColor: '#555',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    width: '25px'
                  }}
                >
                  ×
                </button>
              </div>
            ))}

            <button
              onClick={addHeader}
              style={{
                backgroundColor: '#333',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                marginTop: '10px',
                cursor: 'pointer',
                width: '100%'
              }}
            >
              + Add header
            </button>
          </div>
        </>
      )}
    </>
  )
}

export default Headers;