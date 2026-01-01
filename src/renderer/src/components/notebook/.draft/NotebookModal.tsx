import React, { useState, useEffect } from 'react';
import { useMCP } from '../../context/MCPProvider';
import { X } from 'lucide-react';

interface NotebookModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatContent: string;
}

export const NotebookModal: React.FC<NotebookModalProps> = ({ isOpen, onClose, chatContent }) => {
  const [notebooks, setNotebooks] = useState<string[]>([]);
  const [selectedNotebook, setSelectedNotebook] = useState<string>('');
  const [newNotebookName, setNewNotebookName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const { mcpManager } = useMCP();

  useEffect(() => {
    if (isOpen) {
      loadNotebooks();
    }
  }, [isOpen]);

  const loadNotebooks = async () => {
    try {
      setIsLoading(true);
      const files = await mcpManager.executeTool('desktopCommander', 'list_directory', {
        path: '/Users/cory.naegle/ArborChat/notebooks',
        depth: 1
      });
      setNotebooks(files.filter(file => file.endsWith('.md')));
    } catch (error) {
      console.error('Failed to load notebooks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveToNotebook = async () => {
    try {
      setIsLoading(true);
      const notebookPath = `/Users/cory.naegle/ArborChat/notebooks/${selectedNotebook || newNotebookName}.md`;
      await mcpManager.executeTool('desktopCommander', 'write_file', {
        path: notebookPath,
        content: chatContent,
        mode: selectedNotebook ? 'append' : 'rewrite'
      });
      onClose();
    } catch (error) {
      console.error('Failed to save to notebook:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Save to Notebook</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4">
          <h3 className="font-medium mb-2">Existing Notebooks</h3>
          {isLoading ? (
            <p className="text-gray-500">Loading notebooks...</p>
          ) : (
            <select
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
              value={selectedNotebook}
              onChange={(e) => setSelectedNotebook(e.target.value)}
            >
              <option value="">-- Select a notebook --</option>
              {notebooks.map(notebook => (
                <option key={notebook} value={notebook}>{notebook.replace('.md', '')}</option>
              ))}
            </select>
          )}
        </div>

        <div className="mb-4">
          <h3 className="font-medium mb-2">Or create new notebook</h3>
          <input
            type="text"
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            placeholder="New notebook name"
            value={newNotebookName}
            onChange={(e) => setNewNotebookName(e.target.value)}
          />
        </div>

        <div className="flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={saveToNotebook}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            disabled={(!selectedNotebook && !newNotebookName) || isLoading}
          >
            {isLoading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};