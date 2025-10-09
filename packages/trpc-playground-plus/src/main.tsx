import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { createDynamicTRPCClient } from './utils/trpc/trpc-client'
import TabCodeEditor from './components/TabCodeEditor'
import { ExportButton } from './components/ExportButton'
import { Tab } from './types'
import Headers from './components/Headers'

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
  const [headersOpen, setHeadersOpen] = useState(false);
  const [headers, setHeaders] = useState<Array<{key: string, value: string, enabled: boolean}>>([{key: '', value: '', enabled: true}]);

  const saveDataToLocalStorage = (updatedTabs: Tab[], updatedHeaders: Array<{key: string, value: string, enabled: boolean}>) => {
    localStorage.setItem('trpc-playground-tabs', JSON.stringify(updatedTabs));
    localStorage.setItem('trpc-playground-headers', JSON.stringify(updatedHeaders));
  };

  const handleUpdateTabs = (newTabs: Tab[]) => {
    setTabs(newTabs);
    saveDataToLocalStorage(newTabs, headers);
  };

  const handleUpdateHeaders = (newHeaders: Array<{key: string, value: string, enabled: boolean}>) => {
    setHeaders(newHeaders);
    saveDataToLocalStorage(tabs, newHeaders);
  };

  useEffect(() => {
    fetch('/playground/config')
      .then(res => res.json())
      .then(data => {
        const { defaultTabs, defaultHeaders, ...rest } = data;
        setConfig(rest);

        const savedTabs = localStorage.getItem('trpc-playground-tabs');
        const savedHeaders = localStorage.getItem('trpc-playground-headers');

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
    const headersObject = getHeadersObject();
    const trpcClient = createDynamicTRPCClient({ trpcUrl: config.trpcEndpoint, transformer: config.transformer, headers: headersObject });

    try {
      const executeFunction = new Function('trpc', `
        return (async () => {
          try {
            return await ${specificCode};
          } catch (error) {
            return { error };
          }
        })();
      `);
      const result = await executeFunction(trpcClient);
      setResult(JSON.stringify(result, null, 2));
    } catch (error) {
      setResult(`Erreur: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const importTabs = () => {
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
          }
        } catch (error) {
          alert(`Error during import: ${error instanceof Error ? error.message : String(error)}`);
        }
      };

      reader.readAsText(file);
    };

    fileInput.click();
  };

  return (
    <>
      <Headers headers={headers} setHeaders={handleUpdateHeaders} open={headersOpen} setOpen={setHeadersOpen} />
      <div style={{ padding: 10, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ color: 'white' }}>Connected to : <code>{config.trpcEndpoint}</code></p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <ExportButton tabs={tabs} headers={headers} />
            <button
              onClick={importTabs}
              style={{
                backgroundColor: '#1a1a1a',
                color: 'white',
                border: '1px solid #333',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'background-color 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#333'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 10 12 15 7 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Import
            </button>
            <button
              onClick={() => setHeadersOpen(!headersOpen)}
              style={{
                backgroundColor: '#1a1a1a',
                color: 'white',
                border: '1px solid #333',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#333'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
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