import React from 'react';
import { UploadCloud } from 'lucide-react';

interface DropOverlayProps {
  isDragging: boolean;
}

export const DropOverlay: React.FC<DropOverlayProps> = ({ isDragging }) => {
  if (!isDragging) return null;

  return (
    <div className="fixed inset-0 z-40 bg-blue-600/10 backdrop-blur-xs flex items-center justify-center p-8 pointer-events-none animate-fade-in">
      <div className="bg-white/95 rounded-3xl border-2 border-dashed border-blue-500 p-12 text-center shadow-2xl max-w-lg w-full flex flex-col items-center">
        <div className="w-20 h-20 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-4 animate-bounce">
          <UploadCloud className="w-10 h-10" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-1">Trascina qui i tuoi file</h3>
        <p className="text-sm text-gray-500">
          Rilascia per caricare direttamente nella cartella corrente di EduDrive
        </p>
      </div>
    </div>
  );
};
