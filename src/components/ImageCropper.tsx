import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { X, Check } from 'lucide-react';

interface ImageCropperProps {
  imageSrc: string;
  onCropCompleteAction: (croppedImage: string) => void;
  onCancel: () => void;
  aspectRatio?: number;
}

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous'); 
    image.src = url;
  });

function getRadianAngle(degreeValue: number) {
  return (degreeValue * Math.PI) / 180;
}

export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { width: number; height: number; x: number; y: number },
  rotation = 0
): Promise<string> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No 2d context');
  }

  const maxSize = Math.max(image.width, image.height);
  const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

  canvas.width = safeArea;
  canvas.height = safeArea;

  ctx.translate(safeArea / 2, safeArea / 2);
  ctx.rotate(getRadianAngle(rotation));
  ctx.translate(-safeArea / 2, -safeArea / 2);

  ctx.drawImage(
    image,
    safeArea / 2 - image.width / 2,
    safeArea / 2 - image.height / 2
  );

  const data = ctx.getImageData(0, 0, safeArea, safeArea);

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.putImageData(
    data,
    Math.round(0 - safeArea / 2 + image.width / 2 - pixelCrop.x),
    Math.round(0 - safeArea / 2 + image.height / 2 - pixelCrop.y)
  );

  // Resize if too large
  const MAX_WIDTH = 400;
  const MAX_HEIGHT = 400;
  
  if (canvas.width > MAX_WIDTH || canvas.height > MAX_HEIGHT) {
    const resizeCanvas = document.createElement('canvas');
    const resizeCtx = resizeCanvas.getContext('2d');
    let width = canvas.width;
    let height = canvas.height;

    if (width > height) {
      if (width > MAX_WIDTH) {
        height *= MAX_WIDTH / width;
        width = MAX_WIDTH;
      }
    } else {
      if (height > MAX_HEIGHT) {
        width *= MAX_HEIGHT / height;
        height = MAX_HEIGHT;
      }
    }

    resizeCanvas.width = width;
    resizeCanvas.height = height;
    resizeCtx?.drawImage(canvas, 0, 0, width, height);
    return resizeCanvas.toDataURL('image/webp', 0.8);
  }

  return canvas.toDataURL('image/webp', 0.8);
}

export default function ImageCropper({ imageSrc, onCropCompleteAction, onCancel, aspectRatio = 1 }: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleApply = async () => {
    try {
      if (croppedAreaPixels) {
        const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
        onCropCompleteAction(croppedImage);
      }
    } catch (e) {
      console.error(e);
      alert('Failed to crop image');
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex flex-col bg-black">
      <div className="relative flex-1 bg-black">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={aspectRatio}
          onCropChange={setCrop}
          onCropComplete={onCropComplete}
          onZoomChange={setZoom}
        />
      </div>
      <div className="bg-[#111111] p-6 space-y-6 shrink-0 safe-area-pb">
        <div className="flex flex-col gap-2">
          <label className="text-white text-xs font-bold uppercase tracking-widest text-center">Zoom</label>
          <input
            type="range"
            value={zoom}
            min={1}
            max={3}
            step={0.1}
            aria-labelledby="Zoom"
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-brand"
          />
        </div>
        <div className="flex justify-between items-center max-w-md mx-auto w-full gap-4">
          <button 
            onClick={onCancel}
            className="flex-1 bg-white/10 hover:bg-white/20 text-white px-6 py-4 rounded-2xl font-bold transition-all flex justify-center items-center gap-2"
          >
            <X size={20} /> Cancel
          </button>
          <button 
            onClick={handleApply}
            className="flex-1 bg-brand hover:bg-white text-black px-6 py-4 rounded-2xl font-bold transition-all flex justify-center items-center gap-2"
          >
            <Check size={20} /> Crop & Save
          </button>
        </div>
      </div>
    </div>
  );
}
