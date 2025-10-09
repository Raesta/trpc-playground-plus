import React, { useEffect } from 'react';
import { CodeEditor } from './CodeEditor';
import { Tabs } from './Tabs';
import { RouterSchema, Tab } from '../types';
import { JsonViewer } from './JsonViewer';

const generateId = () => `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

interface TabCodeEditorProps {
  tabs: Tab[];
  onTabsChange: (tabs: Tab[]) => void;
  resultValue: string;
  onResultChange: (value: string) => void;
  schema: RouterSchema;
  onPlayRequest?: (code: string) => Promise<void>;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    height: '100%',
    width: '100%'
  },
  viewers: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
    height: 'calc(100% - 40px)',
    width: '100%',
    minHeight: 0
  }
}

export const TabCodeEditor: React.FC<TabCodeEditorProps> = ({
  tabs,
  onTabsChange,
  resultValue,
  onResultChange,
  schema,
  onPlayRequest
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

      <div style={styles.viewers}>
        {activeTab && (
          <CodeEditor
            value={activeTab.content}
            onChange={handleCodeChange}
            schema={schema}
            onPlayRequest={onPlayRequest}
          />
        )}
        <JsonViewer
          value={resultValue}
          onChange={onResultChange}
        />
      </div>
    </div>
  );
};

export default TabCodeEditor;