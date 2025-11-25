import React, { useState, useRef } from 'react';
import Cropper, { ReactCropperElement } from 'react-cropper';
import { X, RotateCw, Check, MoveHorizontal, MoveVertical, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';

interface ImageEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  onSave: (croppedDataUrl: string) => void;
}

const ImageEditorModal: React.FC<ImageEditorModalProps> = ({ isOpen, onClose, imageSrc, onSave }) => {
  const cropperRef = useRef<ReactCropperElement>(null);
  const [scaleX, setScaleX] = useState(1);
  const [scaleY, setScaleY] = useState(1);

  if (!isOpen || !imageSrc) return null;

  const onCrop = () => {
    const cropper = cropperRef.current?.cropper;
    if (cropper) {
      // Get cropped canvas
      const canvas = cropper.getCroppedCanvas();
      if (canvas) {
        // Convert to base64
        const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
        onSave(croppedDataUrl);
      }
    }
  };

  const rotate = () => {
    cropperRef.current?.cropper.rotate(90);
  };

  const flipH = () => {
    const newScaleX = scaleX === 1 ? -1 : 1;
    cropperRef.current?.cropper.scaleX(newScaleX);
    setScaleX(newScaleX);
  };

  const flipV = () => {
    const newScaleY = scaleY === 1 ? -1 : 1;
    cropperRef.current?.cropper.scaleY(newScaleY);
    setScaleY(newScaleY);
  };

  const reset = () => {
    cropperRef.current?.cropper.reset();
    setScaleX(1);
    setScaleY(1);
  };

  const zoom = (ratio: number) => {
    cropperRef.current?.cropper.zoom(ratio);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-dark-card rounded-lg shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-dark-border">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Editar Imagem</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
            <X size={24} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="flex-1 bg-black overflow-hidden relative p-4 flex items-center justify-center">
             <Cropper
                src={imageSrc}
                style={{ height: 400, width: '100%' }}
                initialAspectRatio={NaN} // Free crop
                guides={true}
                viewMode={1}
                dragMode="move"
                ref={cropperRef}
                background={false}
                responsive={true}
                autoCropArea={0.9}
            />
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg/50">
           <div className="flex flex-wrap gap-2 justify-center mb-4">
               <button onClick={() => rotate()} className="p-2 bg-white dark:bg-dark-card border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200" title="Girar 90º">
                  <RotateCw size={18} />
               </button>
               <button onClick={flipH} className="p-2 bg-white dark:bg-dark-card border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200" title="Inverter Horizontal">
                  <MoveHorizontal size={18} />
               </button>
               <button onClick={flipV} className="p-2 bg-white dark:bg-dark-card border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200" title="Inverter Vertical">
                  <MoveVertical size={18} />
               </button>
               <button onClick={() => zoom(0.1)} className="p-2 bg-white dark:bg-dark-card border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200" title="Zoom In">
                  <ZoomIn size={18} />
               </button>
               <button onClick={() => zoom(-0.1)} className="p-2 bg-white dark:bg-dark-card border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200" title="Zoom Out">
                  <ZoomOut size={18} />
               </button>
               <button onClick={reset} className="p-2 bg-white dark:bg-dark-card border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200" title="Resetar">
                  <RefreshCw size={18} />
               </button>
           </div>
           
           <div className="flex gap-3 justify-center">
              <button 
                onClick={onClose}
                className="px-6 py-2 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={onCrop}
                className="px-6 py-2 rounded bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <Check size={18} /> Salvar Edição
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default ImageEditorModal;