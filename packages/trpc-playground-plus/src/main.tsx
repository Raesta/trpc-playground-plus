import React, { useCallback, useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { createDynamicTRPCClient } from './utils/trpc/trpc-client'
import TabCodeEditor from './components/TabCodeEditor'
import { ExportButton } from './components/ExportButton'
import { Tab, Variable, Header } from './types'
import VarsHeadersDrawer from './components/VarsHeadersDrawer'
import Settings from './components/Settings'
import { theme as t } from './theme'
import { loadSettings, saveSettings } from './settings'

interface RouterSchema {
  [key: string]: {
    type: 'router' | 'query' | 'mutation';
    children?: RouterSchema;
  };
}

interface PlaygroundConfig {
  trpcEndpoint: string;
  transformer?: 'superjson';
  endpoints: string[];
  schema: RouterSchema;
}

function mergeByKey<T extends { key: string }>(globals: T[], locals: T[]): T[] {
  const localKeys = new Set(locals.filter(l => l.key.trim()).map(l => l.key.trim()));
  return [...globals.filter(g => g.key.trim() && !localKeys.has(g.key.trim())), ...locals];
}

function ensureTabFields(tab: any): Tab {
  return {
    ...tab,
    variables: Array.isArray(tab.variables) ? tab.variables : [],
    headers: Array.isArray(tab.headers) ? tab.headers : [],
  };
}

const Playground = () => {
  const [config, setConfig] = useState<PlaygroundConfig | null>(null);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [globalDrawerOpen, setGlobalDrawerOpen] = useState(false);
  const [globalHeaders, setGlobalHeaders] = useState<Header[]>([{key: '', value: '', enabled: true}]);
  const [globalVariables, setGlobalVariables] = useState<Variable[]>([{ key: '', value: '', enabled: true }]);
  const [tabDrawerOpen, setTabDrawerOpen] = useState(false);
  const [splitPosition, setSplitPosition] = useState(() => loadSettings().splitPosition);
  const [fontSize, setFontSize] = useState(() => loadSettings().fontSize);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleSplitChange = useCallback((pct: number) => {
    setSplitPosition(pct);
    saveSettings({ splitPosition: pct });
  }, []);

  const handleSettingsChange = useCallback((partial: Partial<{ splitPosition: number; fontSize: number }>) => {
    if (partial.fontSize !== undefined) {
      setFontSize(partial.fontSize);
    }
    saveSettings(partial);
  }, []);

  const saveDataToLocalStorage = (updatedTabs: Tab[], updatedHeaders: Header[], updatedVariables: Variable[]) => {
    localStorage.setItem('trpc-playground-tabs', JSON.stringify(updatedTabs));
    localStorage.setItem('trpc-playground-headers', JSON.stringify(updatedHeaders));
    localStorage.setItem('trpc-playground-variables', JSON.stringify(updatedVariables));
  };

  const handleUpdateTabs = (newTabs: Tab[]) => {
    setTabs(newTabs);
    saveDataToLocalStorage(newTabs, globalHeaders, globalVariables);
  };

  const handleUpdateGlobalHeaders = (newHeaders: Header[]) => {
    setGlobalHeaders(newHeaders);
    saveDataToLocalStorage(tabs, newHeaders, globalVariables);
  };

  const handleUpdateGlobalVariables = (newVariables: Variable[]) => {
    setGlobalVariables(newVariables);
    saveDataToLocalStorage(tabs, globalHeaders, newVariables);
  };

  const handleUpdateActiveTabVariables = (newVariables: Variable[]) => {
    const newTabs = tabs.map(tab =>
      tab.isActive ? { ...tab, variables: newVariables } : tab
    );
    setTabs(newTabs);
    saveDataToLocalStorage(newTabs, globalHeaders, globalVariables);
  };

  const handleUpdateActiveTabHeaders = (newHeaders: Header[]) => {
    const newTabs = tabs.map(tab =>
      tab.isActive ? { ...tab, headers: newHeaders } : tab
    );
    setTabs(newTabs);
    saveDataToLocalStorage(newTabs, globalHeaders, globalVariables);
  };

  useEffect(() => {
    fetch('/playground/config')
      .then(res => res.json())
      .then(data => {
        const { defaultTabs, defaultHeaders, ...rest } = data;
        setConfig(rest);

        const savedTabs = localStorage.getItem('trpc-playground-tabs');
        const savedHeaders = localStorage.getItem('trpc-playground-headers');
        const savedVariables = localStorage.getItem('trpc-playground-variables');

        if (savedTabs) {
          const parsed = JSON.parse(savedTabs);
          setTabs(parsed.map(ensureTabFields));
        } else {
          setTabs((defaultTabs || []).map(ensureTabFields));
        }

        if (savedHeaders) {
          setGlobalHeaders(JSON.parse(savedHeaders));
        } else {
          setGlobalHeaders(defaultHeaders);
        }

        if (savedVariables) {
          setGlobalVariables(JSON.parse(savedVariables));
        }
      })
      .catch(err => console.error('Error loading configuration:', err));
  }, []);

  if (!config) {
    return <div>Loading playground...</div>;
  }

  const activeTab = tabs.find(tab => tab.isActive);
  const mergedVariables = mergeByKey(globalVariables, activeTab?.variables ?? []);
  const mergedHeaders = mergeByKey(globalHeaders, activeTab?.headers ?? []);

  const getHeadersObject = () => {
    const result: Record<string, string> = {};
    mergedHeaders.forEach(h => {
      if (h.key.trim() && h.value.trim() && h.enabled) {
        result[h.key.trim()] = h.value.trim();
      }
    });
    return result;
  };

  const executeSpecificCode = async (specificCode: string) => {
    setResult('')
    setIsLoading(true);
    const headersObject = getHeadersObject();
    const trpcClient = createDynamicTRPCClient({ trpcUrl: config.trpcEndpoint, transformer: config.transformer, headers: headersObject });

    try {
      const varNames: string[] = [];
      const varValues: any[] = [];
      mergedVariables.forEach(v => {
        if (v.key.trim() && v.enabled && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(v.key.trim())) {
          varNames.push(v.key.trim());
          try { varValues.push(JSON.parse(v.value)); }
          catch { varValues.push(v.value); }
        }
      });

      const executeFunction = new Function('trpc', ...varNames, `
        return (async () => {
          try {
            return await ${specificCode};
          } catch (error) {
            return { error };
          }
        })();
      `);
      const result = await executeFunction(trpcClient, ...varValues);
      setResult(JSON.stringify(result, null, 2));
    } catch (error) {
      setResult(`Erreur: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const importStructure = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json';

    fileInput.onchange = (event) => {
      const target = event.target as HTMLInputElement;
      if (!target.files || target.files.length === 0) return;

      const file = target.files[0];
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const importedData = JSON.parse(content);

          // Support both old format (variables/headers) and new format (globalVariables/globalHeaders)
          const importedGlobalVariables = importedData.globalVariables || importedData.variables;
          const importedGlobalHeaders = importedData.globalHeaders || importedData.headers;

          if (!importedData.tabs || !Array.isArray(importedData.tabs)) {
            alert('Invalid file format');
            return;
          }

          const importedTabs = importedData.tabs.map((tab: any, index: number) => ensureTabFields({
            ...tab,
            isActive: index === 0,
          }));

          if (importedTabs.length > 0) {
            setTabs(importedTabs);
            localStorage.setItem('trpc-playground-tabs', JSON.stringify(importedTabs));
          }

          if (importedGlobalHeaders && Array.isArray(importedGlobalHeaders) && importedGlobalHeaders.length > 0) {
            setGlobalHeaders(importedGlobalHeaders);
            localStorage.setItem('trpc-playground-headers', JSON.stringify(importedGlobalHeaders));
          }

          if (importedGlobalVariables && Array.isArray(importedGlobalVariables) && importedGlobalVariables.length > 0) {
            setGlobalVariables(importedGlobalVariables);
            localStorage.setItem('trpc-playground-variables', JSON.stringify(importedGlobalVariables));
          }

          if (importedData.settings && typeof importedData.settings === 'object') {
            saveSettings(importedData.settings);
            const merged = loadSettings();
            setSplitPosition(merged.splitPosition);
            setFontSize(merged.fontSize);
          }
        } catch (error) {
          alert(`Error during import: ${error instanceof Error ? error.message : String(error)}`);
        }
      };

      reader.readAsText(file);
    };

    fileInput.click();
  };

  const btnStyle: React.CSSProperties = {
    backgroundColor: t.colors.bg.primary,
    color: t.colors.text.primary,
    border: `1px solid ${t.colors.border.primary}`,
    padding: '6px 12px',
    borderRadius: t.radius.md,
    cursor: 'pointer',
    fontSize: t.font.size.md,
    transition: `background-color ${t.transition.normal}`,
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  };

  return (
    <>
      <VarsHeadersDrawer
        title="Global"
        open={globalDrawerOpen}
        setOpen={setGlobalDrawerOpen}
        variables={globalVariables}
        setVariables={handleUpdateGlobalVariables}
        headers={globalHeaders}
        setHeaders={handleUpdateGlobalHeaders}
        side="right"
      />
      {activeTab && (
        <VarsHeadersDrawer
          title={`Tab: ${activeTab.title}`}
          open={tabDrawerOpen}
          setOpen={setTabDrawerOpen}
          variables={activeTab.variables}
          setVariables={handleUpdateActiveTabVariables}
          headers={activeTab.headers}
          setHeaders={handleUpdateActiveTabHeaders}
          side="left"
        />
      )}
      <Settings open={settingsOpen} setOpen={setSettingsOpen} settings={{ splitPosition, fontSize }} onSettingsChange={handleSettingsChange} />
      <div style={{ padding: 10, fontFamily: t.font.sans }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ color: t.colors.text.secondary, fontSize: t.font.size.md }}>
            Connected to : <code>{config.trpcEndpoint}</code>
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <ExportButton tabs={tabs} globalHeaders={globalHeaders} settings={loadSettings()} globalVariables={globalVariables} />
            <button
              onClick={importStructure}
              style={btnStyle}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = t.colors.bg.hover}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = t.colors.bg.primary}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 10 12 15 7 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Import
            </button>
            <button
              onClick={() => setGlobalDrawerOpen(!globalDrawerOpen)}
              style={btnStyle}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = t.colors.bg.hover}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = t.colors.bg.primary}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              Global
            </button>
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              style={btnStyle}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = t.colors.bg.hover}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = t.colors.bg.primary}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', position: 'relative', height: 'calc(100vh - 80px)' }}>
          <TabCodeEditor
            tabs={tabs}
            onTabsChange={handleUpdateTabs}
            resultValue={result}
            onResultChange={setResult}
            schema={config.schema}
            onPlayRequest={executeSpecificCode}
            isLoading={isLoading}
            splitPosition={splitPosition}
            onSplitChange={handleSplitChange}
            mergedVariables={mergedVariables}
            onTabDrawerClick={() => setTabDrawerOpen(!tabDrawerOpen)}
            fontSize={fontSize}
          />
        </div>
      </div>
    </>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Playground />
  </React.StrictMode>
)
