import React, { useEffect, useState, useCallback, useRef } from 'react';
import { CodeEditor } from './CodeEditor';
import { Tabs } from './Tabs';
import { RouterSchema, Tab, Variable } from '../types';
import { JsonViewer } from './JsonViewer';
import { theme as t } from '../theme';

const generateId = () => `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

interface TabCodeEditorProps {
  tabs: Tab[];
  onTabsChange: (tabs: Tab[]) => void;
  resultValue: string;
  onResultChange: (value: string) => void;
  schema: RouterSchema;
  onPlayRequest?: (code: string) => Promise<void>;
  isLoading?: boolean;
  splitPosition: number;
  onSplitChange: (pct: number) => void;
  variables?: Variable[];
  onVariablesClick?: () => void;
}

const DIVIDER_HIT = 16;
const MIN_PANEL_PCT = 15;

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    height: '100%',
    width: '100%'
  },
  viewers: {
    display: 'flex',
    gap: 16,
    height: 'calc(100% - 40px)',
    width: '100%',
    minHeight: 0,
  },
  divider: {
    width: DIVIDER_HIT,
    cursor: 'col-resize',
    flexShrink: 0,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -DIVIDER_HIT / 2 + 0.5,
    marginRight: -DIVIDER_HIT / 2 + 0.5,
    zIndex: 2,
  },
  dividerLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: '1px',
    backgroundColor: t.colors.border.primary,
    transition: `background-color ${t.transition.fast}`,
    pointerEvents: 'none',
  },
  dividerHandle: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '3px',
    padding: '6px 2px',
    borderRadius: t.radius.sm,
    backgroundColor: t.colors.bg.primary,
    border: `1px solid ${t.colors.border.primary}`,
    transition: `all ${t.transition.fast}`,
    pointerEvents: 'none',
  },
  dividerDot: {
    width: 4,
    height: 4,
    borderRadius: '50%',
    backgroundColor: t.colors.text.muted,
    transition: `background-color ${t.transition.fast}`,
  },
  panel: {
    overflow: 'hidden',
    minWidth: 0,
  },
}

export const TabCodeEditor: React.FC<TabCodeEditorProps> = ({
  tabs,
  onTabsChange,
  resultValue,
  onResultChange,
  schema,
  onPlayRequest,
  isLoading,
  splitPosition,
  onSplitChange,
  variables,
  onVariablesClick,
}) => {
  useEffect(() => {
    if (tabs.length === 0) {
      const defaultTab: Tab = {
        id: generateId(),
        title: 'Default tab',
        content: '// Exemple:\n// trpc.hello.query("monde")',
        isActive: true
      };
      onTabsChange([defaultTab]);
    } else if (!tabs.some(tab => tab.isActive)) {
      const updatedTabs = [...tabs];
      updatedTabs[0] = { ...updatedTabs[0], isActive: true };
      onTabsChange(updatedTabs);
    }
  }, [tabs, onTabsChange]);

  const handleTabClick = (tabId: string) => {
    onTabsChange(tabs.map(tab => ({
      ...tab,
      isActive: tab.id === tabId
    })));
  };

  const handleTabClose = (tabId: string) => {
    if (tabs.length <= 1) return;

    const tabIndex = tabs.findIndex(tab => tab.id === tabId);
    const isActiveTab = tabs[tabIndex].isActive;
    const newTabs = tabs.filter(tab => tab.id !== tabId);

    if (isActiveTab && newTabs.length > 0) {
      const newActiveIndex = Math.min(tabIndex, newTabs.length - 1);
      newTabs[newActiveIndex] = { ...newTabs[newActiveIndex], isActive: true };
    }

    onTabsChange(newTabs);
  };

  const handleTabAdd = () => {
    const updatedTabs = tabs.map(tab => ({
      ...tab,
      isActive: false
    }));

    const newTab: Tab = {
      id: generateId(),
      title: `Tab ${tabs.length + 1}`,
      content: '// Exemple:\n// trpc.hello.query("monde")',
      isActive: true
    };

    onTabsChange([...updatedTabs, newTab]);
  };

  const handleTabRename = (tabId: string, newTitle: string) => {
    onTabsChange(tabs.map(tab =>
      tab.id === tabId
        ? { ...tab, title: newTitle }
        : tab
    ));
  };

  const handleTabReorder = (fromId: string, toId: string) => {
    const fromIndex = tabs.findIndex(tab => tab.id === fromId);
    const toIndex = tabs.findIndex(tab => tab.id === toId);

    if (fromIndex === -1 || toIndex === -1) return;

    const newTabs = [...tabs];
    const [movedTab] = newTabs.splice(fromIndex, 1);
    newTabs.splice(toIndex, 0, movedTab);

    onTabsChange(newTabs);
  };

  const handleCodeChange = (newValue: string) => {
    onTabsChange(tabs.map(tab =>
      tab.isActive ? { ...tab, content: newValue } : tab
    ));
  };

  const activeTab = tabs.find(tab => tab.isActive);

  const [leftPct, setLeftPct] = useState(splitPosition);
  useEffect(() => { setLeftPct(splitPosition); }, [splitPosition]);
  const viewersRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current || !viewersRef.current) return;
      const rect = viewersRef.current.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.min(100 - MIN_PANEL_PCT, Math.max(MIN_PANEL_PCT, pct));
      setLeftPct(clamped);
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setLeftPct((current) => { onSplitChange(current); return current; });
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [onSplitChange]);

  return (
    <div style={styles.container}>
      <Tabs
        tabs={tabs}
        onTabClick={handleTabClick}
        onTabClose={handleTabClose}
        onTabAdd={handleTabAdd}
        onTabRename={handleTabRename}
        onTabReorder={handleTabReorder}
      />

      <div ref={viewersRef} style={styles.viewers}>
        <div style={{ ...styles.panel, width: `${leftPct}%` }}>
          {activeTab && (
            <CodeEditor
              value={activeTab.content}
              onChange={handleCodeChange}
              schema={schema}
              onPlayRequest={onPlayRequest}
              variables={variables}
              onVariablesClick={onVariablesClick}
            />
          )}
        </div>
        <div
          style={styles.divider}
          onMouseDown={handleMouseDown}
          onMouseOver={(e) => {
            const line = e.currentTarget.querySelector<HTMLElement>('[data-divider-line]');
            const handle = e.currentTarget.querySelector<HTMLElement>('[data-divider-handle]');
            if (line) line.style.backgroundColor = t.colors.accent.primary;
            if (handle) handle.style.borderColor = t.colors.accent.primary;
            e.currentTarget.querySelectorAll<HTMLElement>('[data-divider-dot]').forEach(d => d.style.backgroundColor = t.colors.text.secondary);
          }}
          onMouseOut={(e) => {
            if (dragging.current) return;
            const line = e.currentTarget.querySelector<HTMLElement>('[data-divider-line]');
            const handle = e.currentTarget.querySelector<HTMLElement>('[data-divider-handle]');
            if (line) line.style.backgroundColor = t.colors.border.primary;
            if (handle) handle.style.borderColor = t.colors.border.primary;
            e.currentTarget.querySelectorAll<HTMLElement>('[data-divider-dot]').forEach(d => d.style.backgroundColor = t.colors.text.muted);
          }}
        >
          <div data-divider-line="" style={styles.dividerLine} />
          <div data-divider-handle="" style={styles.dividerHandle}>
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} data-divider-dot="" style={styles.dividerDot} />
            ))}
          </div>
        </div>
        <div style={{ ...styles.panel, width: `${100 - leftPct}%` }}>
          <JsonViewer
            value={resultValue}
            onChange={onResultChange}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
};

export default TabCodeEditor;