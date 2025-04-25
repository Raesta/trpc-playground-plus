import { Header, Tab } from "../types";

interface ExportButtonProps {
  tabs: Array<Tab>;
  headers: Array<Header>;
}

const styles: Record<string, React.CSSProperties> = {
  button: {
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
  }
}

export const ExportButton = ({ tabs, headers }: ExportButtonProps) => {
  const exportTabs = () => {
    const exportData = {
      tabs,
      headers,
      createdAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `trpc-playground-tabs-${new Date().toISOString().split('T')[0]}.json`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={exportTabs}
      style={styles.button}
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
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
      Export
    </button>
  )
}