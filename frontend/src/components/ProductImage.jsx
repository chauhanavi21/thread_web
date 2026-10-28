import { useEffect, useState } from 'react';
import GarmentDrawing from './GarmentDrawing.jsx';

/**
 * A product picture. `image` is the photo URL the admin set for the product; when it is empty (or fails to load) the
 * garment is drawn in the chosen colour instead. `type` and `color` drive the drawing. A photo is one fixed colour,
 * so `color` only recolours the fallback.
 *
 *  - `ratio` sets the box shape (default portrait 4:5, like fashion product shots).
 *  - `fit="contain"` shows the whole picture instead of cropping it to the box.
 *  - `priority` loads the image straight away (use it for the first picture on a page).
 */
export default function ProductImage({ image, type, color, name, className = '', ratio = 'aspect-[4/5]', fit = 'cover', priority = false, bg = 'bg-brand-200' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [image]);
  const photo = image && !failed;

  return (
    <div className={`relative w-full overflow-hidden ${ratio} ${bg} ${className}`}>
      {photo ? (
        <img
          src={image}
          alt={name}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailed(true)}
          className={`absolute inset-0 h-full w-full ${fit === 'contain' ? 'object-contain' : 'object-cover'}`}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center p-[10%]">
          <GarmentDrawing type={type} color={color} name={name} square={false} bg="bg-transparent" className="h-full" />
        </div>
      )}
    </div>
  );
}
