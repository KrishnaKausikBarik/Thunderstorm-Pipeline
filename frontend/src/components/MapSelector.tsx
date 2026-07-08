import { useEffect } from 'react';
import { MapContainer, TileLayer, Rectangle, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface MapSelectorProps {
  north: number;
  south: number;
  east: number;
  west: number;
  onBoundsChange: (n: number, s: number, e: number, w: number) => void;
}

// Helper component to handle map clicks
function MapClickHandler({ onCenterChange }: { onCenterChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onCenterChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Helper to auto-fit bounds when they change significantly
function MapAutoFitter({ bounds }: { bounds: [[number, number], [number, number]] }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [20, 20], maxZoom: 8 });
  }, [bounds, map]);
  return null;
}

export default function MapSelector({ north, south, east, west, onBoundsChange }: MapSelectorProps) {
  const centerLat = (north + south) / 2;
  const centerLng = (east + west) / 2;
  
  const latSpan = Math.abs(north - south);
  const lngSpan = Math.abs(east - west);

  const handleCenterChange = (lat: number, lng: number) => {
    const halfLat = latSpan / 2;
    const halfLng = lngSpan / 2;
    
    // Update bounds, keeping the same size
    onBoundsChange(
      +(lat + halfLat).toFixed(2),
      +(lat - halfLat).toFixed(2),
      +(lng + halfLng).toFixed(2),
      +(lng - halfLng).toFixed(2)
    );
  };

  const bounds: [[number, number], [number, number]] = [
    [south, west],
    [north, east]
  ];

  return (
    <div className="w-full h-full flex flex-col gap-3">

      {/* Map Container */}
      <div className="flex-1 w-full min-h-[200px] border rounded-lg overflow-hidden relative z-0 bg-darkBg border-borderGlow">
        <div className="absolute bottom-2 left-2 z-[1000] backdrop-blur text-[10px] px-2 py-1 rounded-lg shadow border pointer-events-none bg-darkBg/80 text-white border-borderGlow">
          Click map to recenter box
        </div>
        <MapContainer 
          attributionControl={false}
          center={[centerLat, centerLng]} 
          zoom={5} 
          scrollWheelZoom={true} 
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">Carto</a>'
          />
          
          <Rectangle 
            bounds={bounds} 
            pathOptions={{ color: '#8b5cf6', weight: 2, fillColor: '#8b5cf6', fillOpacity: 0.2 }} 
          />
          
          <MapClickHandler onCenterChange={handleCenterChange} />
          <MapAutoFitter bounds={bounds} />
        </MapContainer>
      </div>
    </div>
  );
}
