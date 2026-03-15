import { useState, useEffect } from "react";
import Checkbox from "./ui/Checkbox";
import Input from "./ui/Input";
import { theme as t } from "../theme";

interface HeadersProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  headers: { key: string; value: string; enabled: boolean }[];
  setHeaders: (headers: { key: string; value: string; enabled: boolean }[]) => void;
}

const Headers = ({ open, setOpen, headers, setHeaders }: HeadersProps) => {
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
    }
  }, [open]);

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      setMounted(false);
      setClosing(false);
      setOpen(false);
    }, 250);
  };
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
      {mounted && (
        <>
          <div
            onClick={handleClose}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: t.colors.bg.overlay,
              zIndex: 9,
              animation: closing ? 'fadeOut 0.25s forwards' : 'fadeIn 0.2s forwards',
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              height: '100%',
              backgroundColor: t.colors.bg.primary,
              borderLeft: `1px solid ${t.colors.border.primary}`,
              padding: '10px',
              boxSizing: 'border-box',
              overflow: 'auto',
              zIndex: 10,
              animation: closing ? 'slideOut 0.25s forwards' : 'slideIn 0.3s forwards',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ color: t.colors.text.primary, margin: 0 }}>Headers</h3>
              <button
                onClick={handleClose}
                style={{
                  background: 'none',
                  border: 'none',
                  color: t.colors.text.secondary,
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '0 4px',
                  lineHeight: 1,
                  transition: `color ${t.transition.fast}`,
                }}
                onMouseOver={(e) => e.currentTarget.style.color = t.colors.text.primary}
                onMouseOut={(e) => e.currentTarget.style.color = t.colors.text.secondary}
              >
                ×
              </button>
            </div>

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
                    backgroundColor: t.colors.bg.hover,
                    color: t.colors.text.primary,
                    border: `1px solid ${t.colors.border.primary}`,
                    borderRadius: t.radius.sm,
                    cursor: 'pointer',
                    width: '30px',
                    transition: `background-color ${t.transition.fast}`,
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = t.colors.accent.danger}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = t.colors.bg.hover}
                >
                  ×
                </button>
              </div>
            ))}

            <button
              onClick={addHeader}
              style={{
                backgroundColor: t.colors.bg.hover,
                color: t.colors.text.primary,
                border: `1px solid ${t.colors.border.primary}`,
                padding: '8px 16px',
                borderRadius: t.radius.md,
                marginTop: '10px',
                cursor: 'pointer',
                width: '100%',
                transition: `background-color ${t.transition.normal}`,
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = t.colors.bg.active}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = t.colors.bg.hover}
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