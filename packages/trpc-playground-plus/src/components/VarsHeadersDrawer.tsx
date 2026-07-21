import { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../ThemeContext';
import type { Header, Variable, VariableType } from '../types';
import { validateVariableValue } from '../utils/variable-validation';
import Checkbox from './ui/Checkbox';
import Input from './ui/Input';

interface VarsHeadersDrawerProps {
  title: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  variables: Variable[];
  setVariables: (variables: Variable[]) => void;
  globalVariables?: Variable[];
  setGlobalVariables?: (variables: Variable[]) => void;
  envVariables?: Variable[];
  headers: Header[];
  setHeaders: (headers: Header[]) => void;
  globalHeaders?: Header[];
  setGlobalHeaders?: (headers: Header[]) => void;
  side: 'left' | 'right';
  extraActions?: React.ReactNode;
}

const TYPE_OPTIONS: VariableType[] = ['string', 'number', 'boolean', 'object', 'array', 'null', 'json'];

const TYPE_LABELS: Record<VariableType, string> = {
  string: 'String',
  number: 'Number',
  boolean: 'Boolean',
  object: 'Object',
  array: 'Array',
  null: 'Null',
  json: 'JSON',
};

const VALID_IDENTIFIER = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
const RESERVED_NAMES = new Set(['trpc']);

const isInvalidName = (key: string): string | null => {
  const trimmed = key.trim();
  if (!trimmed) return null;
  if (!VALID_IDENTIFIER.test(trimmed)) return 'Must be a valid JS identifier';
  if (RESERVED_NAMES.has(trimmed)) return `"${trimmed}" is reserved`;
  return null;
};

type VariableField = 'key' | 'value' | 'enabled' | 'type';
type HeaderField = 'key' | 'value' | 'enabled';

const VarsHeadersDrawer = ({
  title,
  open,
  setOpen,
  variables,
  setVariables,
  globalVariables,
  setGlobalVariables,
  envVariables,
  headers,
  setHeaders,
  globalHeaders,
  setGlobalHeaders,
  side,
  extraActions,
}: VarsHeadersDrawerProps) => {
  const theme = useTheme();
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const [openSections, setOpenSections] = useState({
    headersLocal: true,
    headersGlobal: false,
    varsLocal: true,
    varsGlobal: false,
    varsEnv: false,
  });
  const toggleSection = (key: keyof typeof openSections) => setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const TYPE_COLORS: Record<VariableType, string> = useMemo(
    () => ({
      string: theme.colors.accent.query,
      number: '#98c379',
      boolean: '#c678dd',
      object: '#d19a66',
      array: '#e5c07b',
      null: theme.colors.text.muted,
      json: '#56b6c2',
    }),
    [theme],
  );

  const addBtnStyle: React.CSSProperties = useMemo(
    () => ({
      backgroundColor: theme.colors.bg.hover,
      color: theme.colors.text.secondary,
      border: `1px dashed ${theme.colors.border.primary}`,
      padding: '5px 12px',
      borderRadius: theme.radius.sm,
      marginTop: '6px',
      cursor: 'pointer',
      width: '100%',
      fontSize: theme.font.size.xs,
      transition: `background-color ${theme.transition.normal}`,
    }),
    [theme],
  );

  const removeBtnStyle: React.CSSProperties = useMemo(
    () => ({
      marginLeft: 'auto',
      backgroundColor: 'transparent',
      color: theme.colors.text.muted,
      border: `1px solid transparent`,
      borderRadius: theme.radius.sm,
      cursor: 'pointer',
      width: '24px',
      height: '26px',
      flexShrink: 0,
      fontSize: theme.font.size.md,
      transition: `background-color ${theme.transition.fast}`,
    }),
    [theme],
  );

  const renderSectionDivider = (label: string) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        margin: '20px 0 10px',
      }}
    >
      <div style={{ flex: 1, height: '1px', backgroundColor: theme.colors.border.primary }} />
      <h4
        style={{
          color: theme.colors.text.primary,
          margin: 0,
          fontSize: theme.font.size.sm,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '1.5px',
        }}
      >
        {label}
      </h4>
      <div style={{ flex: 1, height: '1px', backgroundColor: theme.colors.border.primary }} />
    </div>
  );

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

  // --- Generic mutation helpers ---
  const makeVarUpdater = (list: Variable[], setList: (vars: Variable[]) => void) => ({
    add: () => setList([...list, { key: '', value: '', type: 'string', enabled: true }]),
    update: (index: number, field: VariableField, newValue: string | boolean) => {
      const next = [...list];
      if (field === 'key' || field === 'value') {
        next[index][field] = newValue as string;
      } else if (field === 'enabled') {
        next[index][field] = newValue as boolean;
      } else if (field === 'type') {
        next[index].type = newValue as VariableType;
      }
      setList(next);
    },
    remove: (index: number) => setList(list.filter((_, i) => i !== index)),
  });

  const makeHeaderUpdater = (list: Header[], setList: (h: Header[]) => void) => ({
    add: () => setList([...list, { key: '', value: '', enabled: true }]),
    update: (index: number, field: HeaderField, newValue: string | boolean) => {
      const next = [...list];
      if (field === 'key' || field === 'value') {
        next[index][field] = newValue as string;
      } else if (field === 'enabled') {
        next[index][field] = newValue as boolean;
      }
      setList(next);
    },
    remove: (index: number) => setList(list.filter((_, i) => i !== index)),
  });

  const tabVars = makeVarUpdater(variables, setVariables);
  const tabHeaders = makeHeaderUpdater(headers, setHeaders);
  const globalVars = setGlobalVariables ? makeVarUpdater(globalVariables ?? [], setGlobalVariables) : null;
  const globalHdrs = setGlobalHeaders ? makeHeaderUpdater(globalHeaders ?? [], setGlobalHeaders) : null;

  // --- Override detection ---
  const enabledTabVarKeys = new Set(variables.filter((v) => v.enabled && v.key.trim()).map((v) => v.key.trim()));
  const enabledTabHeaderKeys = new Set(headers.filter((h) => h.enabled && h.key.trim()).map((h) => h.key.trim()));
  const envKeys = new Set((envVariables ?? []).map((e) => e.key.trim()).filter(Boolean));

  const scopeSuffix = (text: string, color: string) => (
    <span
      style={{
        color,
        fontWeight: 400,
        textTransform: 'none',
        letterSpacing: 'normal',
        fontSize: theme.font.size.xs,
      }}
    >
      {text}
    </span>
  );

  const renderSectionHeader = (
    label: string,
    count: number,
    isOpen: boolean,
    onToggle: () => void,
    suffix?: React.ReactNode,
  ) => (
    <button
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        width: '100%',
        background: 'none',
        border: 'none',
        padding: '6px 4px',
        margin: '8px 0 4px',
        cursor: 'pointer',
        color: theme.colors.text.muted,
        fontSize: theme.font.size.xs,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        borderRadius: theme.radius.sm,
      }}
      onMouseOver={(e) => (e.currentTarget.style.backgroundColor = theme.colors.bg.hover)}
      onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      <span style={{ fontSize: '10px', width: '10px' }}>{isOpen ? '▾' : '▸'}</span>
      <span>{label}</span>
      <span style={{ opacity: 0.6, fontWeight: 400, textTransform: 'none', letterSpacing: 'normal' }}>({count})</span>
      {suffix}
    </button>
  );

  const renderErrorIcon = (message: string) => (
    <span
      title={message}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '20px',
        flexShrink: 0,
        color: theme.colors.accent.danger,
        fontSize: theme.font.size.sm,
        cursor: 'help',
      }}
    >
      ⚠
    </span>
  );

  const renderVariableRow = (
    variable: Variable,
    index: number,
    api: ReturnType<typeof makeVarUpdater>,
    keyPrefix: string,
    overriddenBy?: 'tab' | 'env' | null,
  ) => {
    const nameError = isInvalidName(variable.key);
    const valueError =
      variable.type !== 'null' ? validateVariableValue(variable.value, variable.type || 'string') : null;
    const isJsonType = ['object', 'array', 'json'].includes(variable.type || 'string');
    const isNull = variable.type === 'null';
    const opacity = overriddenBy ? 0.5 : 1;
    const errorMsg = [nameError, valueError].filter(Boolean).join(' · ');
    return (
      <div key={`${keyPrefix}-${index}`} style={{ marginBottom: '4px', opacity }}>
        <div style={{ display: 'flex', gap: '4px', alignItems: isJsonType ? 'flex-start' : 'center' }}>
          <Checkbox
            id={`${side}-${keyPrefix}-variable-enabled-${index}`}
            checked={variable.enabled}
            onChange={() => api.update(index, 'enabled', !variable.enabled)}
            overridden={!!overriddenBy}
          />
          <select
            value={variable.type || 'string'}
            onChange={(e) => api.update(index, 'type', e.target.value)}
            style={{
              backgroundColor: theme.colors.bg.hover,
              color: TYPE_COLORS[variable.type || 'string'],
              border: `1px solid ${TYPE_COLORS[variable.type || 'string']}`,
              borderRadius: theme.radius.sm,
              padding: '0 3px',
              height: '26px',
              fontSize: theme.font.size.xs,
              cursor: 'pointer',
              flexShrink: 0,
              width: '65px',
            }}
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {TYPE_LABELS[opt]}
              </option>
            ))}
          </select>
          <Input value={variable.key} onChange={(value) => api.update(index, 'key', value)} placeholder="Name" />
          {isJsonType ? (
            <textarea
              value={variable.value}
              onChange={(e) => api.update(index, 'value', e.target.value)}
              placeholder="Value"
              style={{
                flex: 1,
                boxSizing: 'border-box',
                backgroundColor: theme.colors.bg.root,
                color: theme.colors.text.primary,
                border: `1px solid ${valueError ? theme.colors.accent.danger : theme.colors.border.primary}`,
                padding: '4px 6px',
                minHeight: '48px',
                borderRadius: theme.radius.sm,
                fontSize: theme.font.size.sm,
                fontFamily: theme.font.mono,
                outline: 'none',
                resize: 'vertical',
                transition: `border-color ${theme.transition.fast}`,
              }}
              onFocus={(e) => {
                if (!valueError) {
                  e.currentTarget.style.borderColor = theme.colors.accent.primary;
                  e.currentTarget.style.boxShadow = `0 0 0 2px ${theme.colors.border.focus}`;
                }
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = valueError
                  ? theme.colors.accent.danger
                  : theme.colors.border.primary;
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          ) : (
            <Input
              value={isNull ? '' : variable.value}
              onChange={(value) => api.update(index, 'value', value)}
              placeholder="Value"
              disabled={isNull}
              error={!!valueError}
            />
          )}
          {errorMsg && renderErrorIcon(errorMsg)}
          <button
            onClick={() => api.remove(index)}
            style={removeBtnStyle}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.accent.danger;
              e.currentTarget.style.color = '#fff';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = theme.colors.text.muted;
            }}
          >
            ×
          </button>
        </div>
        {overriddenBy && (
          <div
            style={{
              color: theme.colors.text.muted,
              fontSize: theme.font.size.xs,
              fontStyle: 'italic',
              marginLeft: '26px',
              marginTop: '2px',
            }}
          >
            ⊘ Overridden by {overriddenBy} variable
          </div>
        )}
      </div>
    );
  };

  const renderHeaderRow = (
    header: Header,
    index: number,
    api: ReturnType<typeof makeHeaderUpdater>,
    keyPrefix: string,
    overriddenBy?: 'tab' | null,
  ) => {
    const missingKey = header.enabled && !header.key.trim() && header.value.trim();
    const opacity = overriddenBy ? 0.5 : 1;
    return (
      <div key={`${keyPrefix}-${index}`} style={{ marginBottom: '4px', opacity }}>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <Checkbox
            id={`${side}-${keyPrefix}-header-enabled-${index}`}
            checked={header.enabled}
            onChange={() => api.update(index, 'enabled', !header.enabled)}
            overridden={!!overriddenBy}
          />
          <Input value={header.key} onChange={(value) => api.update(index, 'key', value)} placeholder="Key" />
          <Input value={header.value} onChange={(value) => api.update(index, 'value', value)} placeholder="Value" />
          {missingKey && renderErrorIcon('Missing key')}
          <button
            onClick={() => api.remove(index)}
            style={removeBtnStyle}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.accent.danger;
              e.currentTarget.style.color = '#fff';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = theme.colors.text.muted;
            }}
          >
            ×
          </button>
        </div>
        {overriddenBy && (
          <div
            style={{
              color: theme.colors.text.muted,
              fontSize: theme.font.size.xs,
              fontStyle: 'italic',
              marginLeft: '26px',
              marginTop: '2px',
            }}
          >
            ⊘ Overridden by {overriddenBy} header
          </div>
        )}
      </div>
    );
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
              backgroundColor: theme.colors.bg.overlay,
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
              width: '50%',
              backgroundColor: theme.colors.bg.primary,
              [isLeft ? 'borderRight' : 'borderLeft']: `1px solid ${theme.colors.border.primary}`,
              padding: '10px',
              boxSizing: 'border-box',
              overflow: 'auto',
              zIndex: 10,
              animation: closing ? slideOut : slideIn,
            }}
          >
            {/* Header */}
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}
            >
              <h3 style={{ color: theme.colors.text.primary, margin: 0 }}>{title}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {extraActions}
                <button
                  onClick={handleClose}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: theme.colors.text.secondary,
                    fontSize: '20px',
                    cursor: 'pointer',
                    padding: '0 4px',
                    lineHeight: 1,
                    transition: `color ${theme.transition.fast}`,
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.color = theme.colors.text.primary)}
                  onMouseOut={(e) => (e.currentTarget.style.color = theme.colors.text.secondary)}
                >
                  ×
                </button>
              </div>
            </div>

            {/* HEADERS */}
            {renderSectionDivider('Headers')}

            {renderSectionHeader(
              'Local',
              headers.filter((h) => h.key.trim()).length,
              openSections.headersLocal,
              () => toggleSection('headersLocal'),
              scopeSuffix('per tab', theme.colors.accent.mutation),
            )}
            {openSections.headersLocal && (
              <div>
                {headers.map((h, i) => renderHeaderRow(h, i, tabHeaders, 'tab'))}
                <button
                  onClick={tabHeaders.add}
                  style={addBtnStyle}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = theme.colors.bg.active)}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = theme.colors.bg.hover)}
                >
                  + Add local header
                </button>
              </div>
            )}

            {globalHdrs &&
              renderSectionHeader(
                'Global',
                (globalHeaders ?? []).filter((h) => h.key.trim()).length,
                openSections.headersGlobal,
                () => toggleSection('headersGlobal'),
                scopeSuffix('shared', theme.colors.accent.query),
              )}
            {globalHdrs && openSections.headersGlobal && (
              <div>
                {(globalHeaders ?? []).map((h, i) => {
                  const overriddenBy = enabledTabHeaderKeys.has(h.key.trim()) ? 'tab' : null;
                  return renderHeaderRow(h, i, globalHdrs, 'global', overriddenBy);
                })}
                <button
                  onClick={globalHdrs.add}
                  style={addBtnStyle}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = theme.colors.bg.active)}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = theme.colors.bg.hover)}
                >
                  + Add global header
                </button>
              </div>
            )}

            {/* VARIABLES */}
            {renderSectionDivider('Variables')}
            <p
              style={{
                color: theme.colors.text.muted,
                fontSize: theme.font.size.xs,
                margin: '0 0 8px',
                lineHeight: 1.5,
              }}
            >
              Define variables to reuse in your queries. Use a valid JS name and a JSON value, then reference it
              directly in the editor — e.g.{' '}
              <code
                style={{
                  color: theme.colors.text.primary,
                  backgroundColor: theme.colors.bg.code,
                  padding: '1px 5px',
                  borderRadius: theme.radius.sm,
                  fontFamily: theme.font.mono,
                  fontSize: theme.font.size.xs,
                }}
              >
                trpc.user.query(myVar)
              </code>
            </p>

            {renderSectionHeader(
              'Local',
              variables.filter((v) => v.key.trim()).length,
              openSections.varsLocal,
              () => toggleSection('varsLocal'),
              scopeSuffix('per tab', theme.colors.accent.mutation),
            )}
            {openSections.varsLocal && (
              <div>
                {variables.map((v, i) => {
                  const overriddenBy = envKeys.has(v.key.trim()) ? 'env' : null;
                  return renderVariableRow(v, i, tabVars, 'tab', overriddenBy);
                })}
                <button
                  onClick={tabVars.add}
                  style={addBtnStyle}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = theme.colors.bg.active)}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = theme.colors.bg.hover)}
                >
                  + Add local variable
                </button>
              </div>
            )}

            {globalVars &&
              renderSectionHeader(
                'Global',
                (globalVariables ?? []).filter((v) => v.key.trim()).length,
                openSections.varsGlobal,
                () => toggleSection('varsGlobal'),
                scopeSuffix('shared', theme.colors.accent.query),
              )}
            {globalVars && openSections.varsGlobal && (
              <div>
                {(globalVariables ?? []).map((v, i) => {
                  const overriddenBy = envKeys.has(v.key.trim())
                    ? 'env'
                    : enabledTabVarKeys.has(v.key.trim())
                      ? 'tab'
                      : null;
                  return renderVariableRow(v, i, globalVars, 'global', overriddenBy);
                })}
                <button
                  onClick={globalVars.add}
                  style={addBtnStyle}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = theme.colors.bg.active)}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = theme.colors.bg.hover)}
                >
                  + Add global variable
                </button>
              </div>
            )}

            {envVariables &&
              envVariables.length > 0 &&
              renderSectionHeader(
                'Environment',
                envVariables.length,
                openSections.varsEnv,
                () => toggleSection('varsEnv'),
                scopeSuffix('read-only', theme.colors.accent.subscription),
              )}
            {envVariables && envVariables.length > 0 && openSections.varsEnv && (
              <div>
                {envVariables.map((variable, index) => (
                  <div
                    key={`env-${index}-${variable.key}`}
                    style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.85 }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 6px',
                        borderRadius: theme.radius.sm,
                        fontSize: theme.font.size.xs,
                        fontWeight: 600,
                        color: '#fff',
                        backgroundColor: theme.colors.accent.subscription,
                        textTransform: 'uppercase',
                      }}
                      title={`${TYPE_LABELS[variable.type]} (env)`}
                    >
                      env
                    </span>
                    <Input value={variable.key} onChange={() => undefined} placeholder="Name" disabled />
                    <Input
                      value={variable.type === 'null' ? '' : variable.value}
                      onChange={() => undefined}
                      placeholder="Value"
                      disabled
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
};

export default VarsHeadersDrawer;
