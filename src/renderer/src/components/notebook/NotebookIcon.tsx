import React from 'react';
import { BookOpen } from 'lucide-react';

interface NotebookIconProps {
  onClick: () => void;
  className?: string;
}

export const NotebookIcon: React.FC<NotebookIconProps> = ({ onClick, className }) => {
  return (
    <button
      onClick={onClick}
      className={`p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 ${className}`}
      aria-label="Save to notebook"
    >
      <BookOpen className="w-5 h-5" />
    </button>
  );
};