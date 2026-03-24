import { useState, useEffect } from "react";
import Checkbox from "./ui/Checkbox";
import Input from "./ui/Input";
import { theme as t } from "../theme";
import { Variable, Header } from "../types";

interface VarsHeadersDrawerProps {
  title: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  variables: Variable[];
  setVariables: (variables: Variable[]) => void;
  headers: Header[];
  setHeaders: (headers: Header[]) => void;
  side: 'left' | 'right';
  extraActions?: React.ReactNode;
}

function resolveType(value: string): { type: string; color: string } {
  if (!value.trim()) return { type: '', color: '' };
  try {
    const parsed = JSON.parse(value);
    if (parsed === null) return { type: 'null', color: t.colors.text.muted };
    if (Array.isArray(parsed)) return { type: 'array', color: '#e5c07b' };
    switch (typeof parsed) {
      case 'string':  return { type: 'string',  color: t.colors.accent.query };
      case 'number':  return { type: 'number',  color: '#98c379' };
      case 'boolean': return { type: 'boolean', color: '#c678dd' };
      case 'object':  return { type: 'object',  color: '#d19a66' };
      default:        return { type: 'string',  color: t.colors.accent.query };
    }
  } catch {
    return { type: 'string', color: t.colors.accent.query };
  }
}

const VALID_IDENTIFIER = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
const RESERVED_NAMES = new Set(['trpc']);

const isInvalidName = (key: string): string | null => {
  const trimmed = key.trim();
  if (!trimmed) return null;
  if (!VALID_IDENTIFIER.test(trimmed)) return 'Must be a valid JS identifier';
  if (RESERVED_NAMES.has(trimmed)) return `"${trimmed}" is reserved`;
  return null;
};

const addBtnStyle: React.CSSProperties = {
  backgroundColor: t.colors.bg.hover,
  color: t.colors.text.primary,
  border: `1px solid ${t.colors.border.primary}`,
  padding: '8px 16px',
  borderRadius: t.radius.md,
  marginTop: '10px',
  cursor: 'pointer',
  width: '100%',
  transition: `background-color ${t.transition.normal}`,
};

const removeBtnStyle: React.CSSProperties = {
  marginLeft: 'auto',
  backgroundColor: t.colors.bg.hover,
  color: t.colors.text.primary,
  border: `1px solid ${t.colors.border.primary}`,
  borderRadius: t.radius.sm,
  cursor: 'pointer',
  width: '30px',
  height: '30px',
  flexShrink: 0,
  transition: `background-color ${t.transition.fast}`,
};

const sectionTitleStyle: React.CSSProperties = {
  color: t.colors.text.secondary,
  fontSize: t.font.size.sm,
  margin: '0 0 8px',
  fontWeight: 600,
};

const VarsHeadersDrawer = ({ title, open, setOpen, variables, setVariables, headers, setHeaders, side, extraActions }: VarsHeadersDrawerProps) => {
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

  // Variables handlers
  const addVariable = () => {
    setVariables([...variables, { key: '', value: '', enabled: true }]);
  };

  const updateVariable = (index: number, field: 'key' | 'value' | 'enabled', newValue: string | boolean) => {
    const newVariables = [...variables];
    if (field === 'key' || field === 'value') {
      newVariables[index][field] = newValue as string;
    } else if (field === 'enabled') {
      newVariables[index][field] = newValue as boolean;
    }
    setVariables(newVariables);
  };

  const removeVariable = (index: number) => {
    setVariables(variables.filter((_, i) => i !== index));
  };

  // Headers handlers
  const addHeader = () => {
    setHeaders([...headers, { key: '', value: '', enabled: true }]);
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

  const isLeft = side === 'left';
  const slideIn = isLeft ? 'slideInLeft 0.3s forwards' : 'slideIn 0.3s forwards';
  const slideOut = isLeft ? 'slideOutLeft 0.25s forwards' : 'slideOut 0.25s forwards';

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
              [isLeft ? 'left' : 'right']: 0,
              top: 0,
              height: '100%',
              maxWidth: '30vw',
              backgroundColor: t.colors.bg.primary,
              [isLeft ? 'borderRight' : 'borderLeft']: `1px solid ${t.colors.border.primary}`,
              padding: '10px',
              boxSizing: 'border-box',
              overflow: 'auto',
              zIndex: 10,
              animation: closing ? slideOut : slideIn,
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ color: t.colors.text.primary, margin: 0 }}>{title}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {extraActions}
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
            </div>

            {/* Headers Section */}
            <h4 style={sectionTitleStyle}>Headers</h4>

            {headers.map((header, index) => (
              <div key={index} style={{ display: 'flex', marginBottom: '8px', gap: '5px' }}>
                <Checkbox
                  id={`${side}-header-enabled-${index}`}
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
              style={addBtnStyle}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = t.colors.bg.active}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = t.colors.bg.hover}
            >
              + Add header
            </button>

            {/* Divider */}
            <div style={{
              borderTop: `1px solid ${t.colors.border.primary}`,
              margin: '16px 0',
            }} />

            {/* Variables Section */}
            <h4 style={sectionTitleStyle}>Variables</h4>
            <p style={{
              color: t.colors.text.muted,
              fontSize: t.font.size.xs,
              margin: '0 0 12px',
              lineHeight: 1.5,
            }}>
              Define variables to reuse in your queries. Use a valid JS name and a JSON value, then reference it directly in the editor — e.g. <code style={{ color: t.colors.text.secondary }}>trpc.user.query(myVar)</code>
            </p>

            {variables.map((variable, index) => {
              const error = isInvalidName(variable.key);
              return (
                <div key={index} style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                    <Checkbox
                      id={`${side}-variable-enabled-${index}`}
                      checked={variable.enabled}
                      onChange={() => updateVariable(index, 'enabled', !variable.enabled)}
                    />
                    <Input
                      value={variable.key}
                      onChange={(value) => updateVariable(index, 'key', value)}
                      placeholder="Name"
                    />
                    <Input
                      value={variable.value}
                      onChange={(value) => updateVariable(index, 'value', value)}
                      placeholder="Value (JSON)"
                    />
                    {(() => {
                      const resolved = resolveType(variable.value);
                      if (!resolved.type) return null;
                      return (
                        <span style={{
                          fontSize: t.font.size.xs,
                          color: resolved.color,
                          border: `1px solid ${resolved.color}`,
                          borderRadius: t.radius.sm,
                          padding: '0 6px',
                          whiteSpace: 'nowrap',
                          height: '30px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxSizing: 'border-box',
                          flex: 1,
                          opacity: 0.8,
                          maxWidth: '100px',
                        }}>
                          {resolved.type}
                        </span>
                      );
                    })()}
                    <button
                      onClick={() => removeVariable(index)}
                      style={removeBtnStyle}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = t.colors.accent.danger}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = t.colors.bg.hover}
                    >
                      ×
                    </button>
                  </div>
                  {error && (
                    <div style={{ color: t.colors.accent.danger, fontSize: t.font.size.xs, marginTop: '2px', marginLeft: '30px' }}>
                      {error}
                    </div>
                  )}
                </div>
              );
            })}

            <button
              onClick={addVariable}
              style={addBtnStyle}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = t.colors.bg.active}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = t.colors.bg.hover}
            >
              + Add variable
            </button>
          </div>
        </>
      )}
    </>
  );
};

export default VarsHeadersDrawer;
