import React, { useCallback, useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { createDynamicTRPCClient } from './utils/trpc/trpc-client'
import TabCodeEditor from './components/TabCodeEditor'
import { ExportButton } from './components/ExportButton'
import { Tab, Variable } from './types'
import Headers from './components/Headers'
import Variables from './components/Variables'
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

const Playground = () => {
  const [config, setConfig] = useState<PlaygroundConfig | null>(null);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [headersOpen, setHeadersOpen] = useState(false);
  const [headers, setHeaders] = useState<Array<{key: string, value: string, enabled: boolean}>>([{key: '', value: '', enabled: true}]);
  const [variablesOpen, setVariablesOpen] = useState(false);
  const [variables, setVariables] = useState<Variable[]>([{ key: '', value: '', enabled: true }]);
  const [splitPosition, setSplitPosition] = useState(() => loadSettings().splitPosition);

  const handleSplitChange = useCallback((pct: number) => {
    setSplitPosition(pct);
    saveSettings({ splitPosition: pct });
  }, []);

  const saveDataToLocalStorage = (updatedTabs: Tab[], updatedHeaders: Array<{key: string, value: string, enabled: boolean}>, updatedVariables: Variable[]) => {
    localStorage.setItem('trpc-playground-tabs', JSON.stringify(updatedTabs));
    localStorage.setItem('trpc-playground-headers', JSON.stringify(updatedHeaders));
    localStorage.setItem('trpc-playground-variables', JSON.stringify(updatedVariables));
  };

  const handleUpdateTabs = (newTabs: Tab[]) => {
    setTabs(newTabs);
    saveDataToLocalStorage(newTabs, headers, variables);
  };

  const handleUpdateHeaders = (newHeaders: Array<{key: string, value: string, enabled: boolean}>) => {
    setHeaders(newHeaders);
    saveDataToLocalStorage(tabs, newHeaders, variables);
  };

  const handleUpdateVariables = (newVariables: Variable[]) => {
    setVariables(newVariables);
    saveDataToLocalStorage(tabs, headers, newVariables);
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
          setTabs(JSON.parse(savedTabs));
        } else {
          setTabs(defaultTabs);
        }

        if (savedHeaders) {
          setHeaders(JSON.parse(savedHeaders));
        } else {
          setHeaders(defaultHeaders);
        }

        if (savedVariables) {
          setVariables(JSON.parse(savedVariables));
        }
      })
      .catch(err => console.error('Error loading configuration:', err));
  }, []);

  if (!config) {
    return <div>Loading playground...</div>;
  }

  const getHeadersObject = () => {
    const result: Record<string, string> = {};

    headers.forEach(h => {
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
      variables.forEach(v => {
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

          if (!importedData.tabs || !Array.isArray(importedData.tabs) || !importedData.headers || !Array.isArray(importedData.headers)) {
            alert('Invalid file format');
            return;
          }

          const importedTabs = importedData.tabs.map((tab: any, index: number) => ({
            ...tab,
            isActive: index === 0,
          }));

          if (importedTabs.length > 0) {
            setTabs(importedTabs);
            localStorage.setItem('trpc-playground-tabs', JSON.stringify(importedTabs));
          }

          if (importedData.headers.length > 0) {
            setHeaders(importedData.headers);
            localStorage.setItem('trpc-playground-headers', JSON.stringify(importedData.headers));
          }

          if (importedData.variables && Array.isArray(importedData.variables) && importedData.variables.length > 0) {
            setVariables(importedData.variables);
            localStorage.setItem('trpc-playground-variables', JSON.stringify(importedData.variables));
          }

          if (importedData.settings && typeof importedData.settings === 'object') {
            saveSettings(importedData.settings);
            const merged = loadSettings();
            setSplitPosition(merged.splitPosition);
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
      <Headers headers={headers} setHeaders={handleUpdateHeaders} open={headersOpen} setOpen={setHeadersOpen} />
      <Variables variables={variables} setVariables={handleUpdateVariables} open={variablesOpen} setOpen={setVariablesOpen} />
      <div style={{ padding: 10, fontFamily: t.font.sans }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ color: t.colors.text.secondary, fontSize: t.font.size.md }}>
            Connected to : <code>{config.trpcEndpoint}</code>
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <ExportButton tabs={tabs} headers={headers} settings={loadSettings()} variables={variables} />
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
              onClick={() => setHeadersOpen(!headersOpen)}
              style={btnStyle}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = t.colors.bg.hover}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = t.colors.bg.primary}
            >
              Headers
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
            variables={variables}
            onVariablesClick={() => setVariablesOpen(!variablesOpen)}
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