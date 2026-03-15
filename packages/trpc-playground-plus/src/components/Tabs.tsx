import React, { useState, useRef, useEffect } from 'react';
import { theme as t } from '../theme';

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
  onTabReorder?: (fromId: string, toId: string) => void;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    padding: '6px 12px',
    color: t.colors.text.primary,
    cursor: 'pointer',
    border: `1px solid ${t.colors.border.primary}`,
    borderRadius: t.radius.md,
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
    transition: `background-color ${t.transition.normal}`,
    minWidth: '120px'
  },
  title: {
    marginRight: '16px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: t.font.size.md,
  },
  input: {
    width: 'calc(100% - 24px)',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: t.colors.text.secondary,
    fontSize: t.font.size.md,
    cursor: 'pointer',
    padding: '0 4px',
    position: 'absolute',
    right: '4px',
    top: '50%',
    transform: 'translateY(-50%)',
    transition: `color ${t.transition.fast}`,
  },
  addButton: {
    backgroundColor: t.colors.bg.primary,
    color: t.colors.text.primary,
    border: `1px solid ${t.colors.border.primary}`,
    padding: '6px 12px',
    borderRadius: t.radius.md,
    cursor: 'pointer',
    fontSize: t.font.size.md,
    transition: `background-color ${t.transition.normal}`,
  },
}

export const Tabs: React.FC<TabsProps> = ({ tabs, onTabClick, onTabClose, onTabAdd, onTabRename, onTabReorder }) => {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
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

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, tabId: string) => {
    setDraggedTabId(tabId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tabId);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, tabId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (draggedTabId && draggedTabId !== tabId) {
      setDragOverTabId(tabId);
    } else if (draggedTabId === tabId) {
      setDragOverTabId(null);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    // Only reset if we really leave the element (not its children)
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    // Check if we are still in the tab area (with a margin for the drop zone)
    if (
      x < rect.left - 140 ||
      x > rect.right + 140 ||
      y < rect.top ||
      y > rect.bottom
    ) {
      setDragOverTabId(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, toTabId: string) => {
    e.preventDefault();

    const fromTabId = e.dataTransfer.getData('text/plain');

    if (fromTabId && fromTabId !== toTabId && onTabReorder) {
      onTabReorder(fromTabId, toTabId);
    }

    setDraggedTabId(null);
    setDragOverTabId(null);
  };

  const handleDragEnd = () => {
    setDraggedTabId(null);
    setDragOverTabId(null);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'row',
      gap: 8,
    }}>
      {tabs.map((tab, index) => {
        const isDragging = draggedTabId === tab.id;
        const isDragOver = dragOverTabId === tab.id;
        const isDraggable = editingTabId !== tab.id; // Do not allow dragging while editing

        // Calculate the position of the drop indicator
        const draggedIndex = draggedTabId ? tabs.findIndex(t => t.id === draggedTabId) : -1;
        const draggedTab = draggedTabId ? tabs.find(t => t.id === draggedTabId) : null;
        const showDropIndicator = isDragOver && draggedIndex !== -1 && draggedIndex !== index;

        return (
          <div
            key={tab.id}
            className={`tab ${tab.isActive ? 'active-tab' : ''}`}
            draggable={isDraggable}
            onClick={() => onTabClick(tab.id)}
            onDoubleClick={() => handleDoubleClick(tab)}
            onDragStart={(e) => handleDragStart(e, tab.id)}
            onDragOver={(e) => handleDragOver(e, tab.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, tab.id)}
            onDragEnd={handleDragEnd}
            style={{
              ...styles.tab,
              backgroundColor: tab.isActive ? t.colors.bg.active : t.colors.bg.primary,
              marginBottom: tab.isActive ? '-1px' : '0',
              opacity: isDragging ? 0.5 : 1,
              cursor: isDraggable ? 'grab' : 'default',
              border: `1px solid ${t.colors.border.primary}`,
              transition: `opacity ${t.transition.normal}, margin 0.15s ease-out`,
              position: 'relative',
              marginLeft: showDropIndicator && draggedIndex > index ? '132px' : '0',
              marginRight: showDropIndicator && draggedIndex < index ? '132px' : '0',
            }}
            onMouseOver={(e) => {
              if (!tab.isActive) {
                e.currentTarget.style.backgroundColor = t.colors.bg.hover;
              }
            }}
            onMouseOut={(e) => {
              if (!tab.isActive) {
                e.currentTarget.style.backgroundColor = t.colors.bg.primary;
              }
            }}
          >
          {showDropIndicator && draggedTab && (
            <>
              {/* Invisible drop zone to extend clickable area */}
              <div
                onDragOver={(e) => {
                  e.stopPropagation();
                  handleDragOver(e, tab.id);
                }}
                onDrop={(e) => handleDrop(e, tab.id)}
                onDragLeave={handleDragLeave}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: draggedIndex > index ? '-132px' : 'auto',
                  right: draggedIndex < index ? '-132px' : 'auto',
                  width: '120px',
                  height: '100%',
                  pointerEvents: 'auto',
                }}
              />
              {/* Visual preview of the tab */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: draggedIndex > index ? '-132px' : 'auto',
                  right: draggedIndex < index ? '-132px' : 'auto',
                  padding: '6px 12px',
                  color: t.colors.text.secondary,
                  border: `2px dashed ${t.colors.border.secondary}`,
                  borderRadius: t.radius.md,
                  display: 'flex',
                  alignItems: 'center',
                  minWidth: '120px',
                  backgroundColor: 'rgba(45, 45, 74, 0.3)',
                  boxShadow: t.shadow.sm,
                  pointerEvents: 'none',
                }}
              >
                <span
                  style={{
                    marginRight: '16px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: '14px',
                  }}
                >
                  {draggedTab.title}
                </span>
              </div>
            </>
          )}
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
              e.currentTarget.style.color = t.colors.text.primary;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.color = t.colors.text.secondary;
            }}
          >
            ×
          </button>
        </div>
        );
      })}
      <button
        onClick={onTabAdd}
        style={styles.addButton}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = t.colors.bg.hover}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = t.colors.bg.primary}
      >
        +
      </button>
    </div>
  );
};

export default Tabs;