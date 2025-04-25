import React, { useState, useRef, useEffect } from 'react';

interface Tab {
  id: string;
  title: string;
  content: string;
  isActive?: boolean;
}

interface TabsProps {
  tabs: Tab[];
  onTabClick: (id: string) => void;
  onTabClose: (id: string) => void;
  onTabAdd: () => void;
  onTabRename?: (id: string, newTitle: string) => void;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    padding: '6px 12px',
    color: 'white',
    cursor: 'pointer',
    border: '1px solid #333',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
    transition: 'background-color 0.2s',
    minWidth: '120px'
  },
  title: {
    marginRight: '16px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: '14px'
  },
  input: {
    width: 'calc(100% - 24px)',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: '#888',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '0 4px',
    position: 'absolute',
    right: '4px',
    top: '50%',
    transform: 'translateY(-50%)',
    transition: 'color 0.2s'
  },
  addButton: {
    backgroundColor: '#1a1a1a',
    color: 'white',
    border: '1px solid #333',
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'background-color 0.2s',
  },
}

export const Tabs: React.FC<TabsProps> = ({ tabs, onTabClick, onTabClose, onTabAdd, onTabRename }) => {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTabId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingTabId]);

  const handleDoubleClick = (tab: Tab) => {
    if (onTabRename) {
      setEditingTabId(tab.id);
      setEditingTitle(tab.title);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingTitle(e.target.value);
  };

  const handleInputBlur = () => {
    if (editingTabId && onTabRename && editingTitle.trim() !== '') {
      onTabRename(editingTabId, editingTitle);
    }
    setEditingTabId(null);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (editingTabId && onTabRename && editingTitle.trim() !== '') {
        onTabRename(editingTabId, editingTitle);
      }
      setEditingTabId(null);
    } else if (e.key === 'Escape') {
      setEditingTabId(null);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'row',
      gap: 8,
    }}>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab ${tab.isActive ? 'active-tab' : ''}`}
          onClick={() => onTabClick(tab.id)}
          onDoubleClick={() => handleDoubleClick(tab)}
          style={{
            ...styles.tab,
            backgroundColor: tab.isActive ? '#333' : '#1a1a1a',
            marginBottom: tab.isActive ? '-1px' : '0',
          }}
          onMouseOver={(e) => {
            if (!tab.isActive) {
              e.currentTarget.style.backgroundColor = '#222';
            }
          }}
          onMouseOut={(e) => {
            if (!tab.isActive) {
              e.currentTarget.style.backgroundColor = '#1a1a1a';
            }
          }}
        >
          {editingTabId === tab.id ? (
            <input
              ref={inputRef}
              value={editingTitle}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              onKeyDown={handleInputKeyDown}
              className="tab-edit-input"
              style={styles.input}
            />
          ) : (
            <span
              style={styles.title}
              title="Double-click to edit"
            >
              {tab.title}
            </span>
          )}
          <button
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation();
              onTabClose(tab.id);
            }}
            style={styles.closeButton}
            onMouseOver={(e) => {
              e.currentTarget.style.color = '#fff';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.color = '#888';
            }}
          >
            ×
          </button>
        </div>
      ))}
      <button
        onClick={onTabAdd}
        style={styles.addButton}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#333'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
      >
        +
      </button>
    </div>
  );
};

export default Tabs;