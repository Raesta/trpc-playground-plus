import { useMemo } from "react";
import { Header, PlaygroundSettings, Tab, Variable } from "../types";
import { useTheme } from '../ThemeContext';

interface ExportButtonProps {
  tabs: Array<Tab>;
  globalHeaders: Array<Header>;
  settings: PlaygroundSettings;
  globalVariables: Array<Variable>;
}

export const ExportButton = ({ tabs, globalHeaders, settings, globalVariables }: ExportButtonProps) => {
  const theme = useTheme();

  const styles: Record<string, React.CSSProperties> = useMemo(() => ({
    button: {
      backgroundColor: theme.colors.bg.primary,
      color: theme.colors.text.primary,
      border: `1px solid ${theme.colors.border.primary}`,
      padding: '6px 12px',
      borderRadius: theme.radius.md,
      cursor: 'pointer',
      fontSize: theme.font.size.md,
      transition: `background-color ${theme.transition.normal}`,
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    }
  }), [theme]);

  const exportStructure = () => {
    const exportData = {
      tabs,
      globalHeaders,
      settings,
      globalVariables,
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
      onClick={exportStructure}
      style={styles.button}
      onMouseOver={(e) => e.currentTarget.style.backgroundColor = theme.colors.bg.hover}
      onMouseOut={(e) => e.currentTarget.style.backgroundColor = theme.colors.bg.primary}
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
