import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';
import { getPublicPhotoShare } from '../../services/firebaseService';

interface PublicPhotoGalleryViewProps {
  shareId: string;
}

export const PublicPhotoGalleryView: React.FC<PublicPhotoGalleryViewProps> = ({ shareId }) => {
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadPhotos() {
      try {
        setIsLoading(true);
        const urls = await getPublicPhotoShare(shareId);
        if (isMounted) {
          setPhotoUrls(urls);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error loading public photo share:', err);
        if (isMounted) {
          setError('Failed to load photos');
          setIsLoading(false);
        }
      }
    }
    loadPhotos();
    return () => { isMounted = false; };
  }, [shareId]);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photoUrls.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < photoUrls.length - 1 ? prev + 1 : 0));
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photoUrls.length]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center text-white">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs text-slate-400 font-medium">Loading property gallery...</p>
      </div>
    );
  }

  if (error || photoUrls.length === 0) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center text-white p-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-4">
          <ImageIcon className="w-8 h-8" />
        </div>
        <h2 className="text-base font-bold text-white mb-1">No photos available</h2>
        <p className="text-xs text-slate-400 max-w-xs">
          This property photo gallery has no images or may have expired.
        </p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col select-none overflow-hidden">
      {/* Top Header with Counter */}
      <div className="absolute top-0 inset-x-0 z-20 p-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
        <div className="text-white text-xs font-bold px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/15">
          {currentIndex + 1} / {photoUrls.length}
        </div>
      </div>

      {/* Main Image Carousel View */}
      <div className="flex-1 relative flex items-center justify-center p-2 sm:p-6">
        <img
          src={photoUrls[currentIndex]}
          alt={`Property Photo ${currentIndex + 1}`}
          className="max-h-full max-w-full object-contain rounded-xl shadow-2xl transition-transform duration-200"
        />

        {/* Navigation Buttons (if multiple photos) */}
        {photoUrls.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-3 sm:left-6 w-11 h-11 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md border border-white/15 transition-colors shadow-lg"
              aria-label="Previous photo"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-3 sm:right-6 w-11 h-11 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md border border-white/15 transition-colors shadow-lg"
              aria-label="Next photo"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnail Strip (if multiple photos) */}
      {photoUrls.length > 1 && (
        <div className="p-3 bg-black/90 backdrop-blur-md flex items-center justify-center gap-2 overflow-x-auto border-t border-white/15">
          {photoUrls.map((url, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${
                currentIndex === idx ? 'border-emerald-500 scale-105 shadow-md' : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <img src={url} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};


