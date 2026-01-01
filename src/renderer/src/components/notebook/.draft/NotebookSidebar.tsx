import React, { useState, useEffect } from 'react';
import { useMCP } from '../../context/MCPProvider';
import { X, BookOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface NotebookSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotebookSidebar: React.FC<NotebookSidebarProps> = ({ isOpen, onClose }) => {
  const [notebooks, setNotebooks] = useState<string[]>([]);
  const [selectedNotebook, setSelectedNotebook] = useState<string | null>(null);
  const [notebookContent, setNotebookContent] = useState<string>('');
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

  const loadNotebookContent = async (notebook: string) => {
    try {
      setIsLoading(true);
      const content = await mcpManager.executeTool('desktopCommander', 'read_file', {
        path: `/Users/cory.naegle/ArborChat/notebooks/${notebook}`
      });
      setNotebookContent(content);
      setSelectedNotebook(notebook);
    } catch (error) {
      console.error('Failed to load notebook content:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-white dark:bg-gray-800 shadow-lg z-40 flex flex-col">
      <div className="p-4 border-b dark:border-gray-700">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5" />
            <h2 className="text-xl font-semibold">Notebooks</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-4 border-b dark:border-gray-700">
        <h3 className="font-medium mb-2">Your Notebooks</h3>
        {isLoading && !notebooks.length ? (
          <p className="text-gray-500 dark:text-gray-400">Loading notebooks...</p>
        ) : notebooks.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No notebooks found</p>
        ) : (
          <ul className="space-y-1">
            {notebooks.map(notebook => (
              <li key={notebook}>
                <button
                  onClick={() => loadNotebookContent(notebook)}
                  className={`w-full text-left p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${selectedNotebook === notebook ? 'bg-blue-50 dark:bg-blue-900' : ''}`}
                >
                  {notebook.replace('.md', '')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isLoading && selectedNotebook ? (
          <p className="text-gray-500 dark:text-gray-400">Loading notebook content...</p>
        ) : selectedNotebook ? (
          <div className="prose dark:prose-invert max-w-none">
            <h3 className="font-medium mb-2">{selectedNotebook.replace('.md', '')}</h3>
            <ReactMarkdown>{notebookContent}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400">Select a notebook to view its contents</p>
        )}
      </div>
    </div>
  );
};