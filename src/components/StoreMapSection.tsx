import React, { useState, useEffect } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useMap,
  useMapsLibrary,
  useAdvancedMarkerRef,
} from '@vis.gl/react-google-maps';
import {
  MapPin,
  Phone,
  Navigation,
  Clock,
  ExternalLink,
} from 'lucide-react';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export const LOVEYS_COORDS = {
  lat: 24.2054,
  lng: 83.0355,
};

const RENUKOOT_LANDMARKS = [
  { label: 'Hindalco Colony', query: 'Hindalco Colony, Renukoot' },
  { label: 'Murdhawa Market', query: 'Murdhawa, Renukoot' },
  { label: 'Pipri / Rihand Road', query: 'Pipri, Sonbhadra' },
  { label: 'Renukoot Railway Station', query: 'Renukoot Railway Station' },
];

interface RouteCalculatorProps {
  destination: { lat: number; lng: number };
  originQuery: string;
  triggerId: number;
  onRouteInfo: (info: { distanceText: string; durationText: string } | null) => void;
}

function RoutePolylineOverlay({
  destination,
  originQuery,
  triggerId,
  onRouteInfo,
}: RouteCalculatorProps) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const geocodingLib = useMapsLibrary('geocoding');

  useEffect(() => {
    if (!map || !routesLib || !geocodingLib || !originQuery.trim() || triggerId === 0) {
      return;
    }

    let polylines: any[] = [];
    let isCancelled = false;

    const calculateRoute = async () => {
      try {
        const geocoder = new geocodingLib.Geocoder();
        const geoRes = await geocoder.geocode({
          address: `${originQuery}, Sonbhadra, Uttar Pradesh, India`,
        });

        if (isCancelled || !geoRes.results?.[0]?.geometry?.location) {
          onRouteInfo(null);
          return;
        }

        const originLoc = geoRes.results[0].geometry.location;
        const Route = (routesLib as any).Route;
        if (!Route || typeof Route.computeRoutes !== 'function') {
          onRouteInfo(null);
          return;
        }

        const { routes } = await Route.computeRoutes({
          origin: originLoc,
          destination,
          travelMode: 'DRIVING',
          fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
        });

        if (isCancelled || !routes?.length) {
          onRouteInfo(null);
          return;
        }

        polylines = routes[0].createPolylines();
        polylines.forEach((p: any) => p.setMap(map));

        if (routes[0].viewport) {
          map.fitBounds(routes[0].viewport);
        }

        const distKm = routes[0].distanceMeters
          ? `${(routes[0].distanceMeters / 1000).toFixed(1)} km`
          : 'Calculated';
        const durMin = routes[0].durationMillis
          ? `${Math.max(1, Math.round(routes[0].durationMillis / 60000))} mins`
          : 'Drive route';

        onRouteInfo({
          distanceText: distKm,
          durationText: durMin,
        });
      } catch (err) {
        console.warn('Route preview note:', err);
        onRouteInfo(null);
      }
    };

    calculateRoute();

    return () => {
      isCancelled = true;
      polylines.forEach((p) => p.setMap(null));
    };
  }, [map, routesLib, geocodingLib, originQuery, triggerId, destination, onRouteInfo]);

  return null;
}

interface StoreMapSectionProps {
  address?: string;
  phone?: string;
  whatsapp?: string;
  openingHours?: string;
  googleMapsUrl?: string;
  compact?: boolean;
}

export const StoreMapSection: React.FC<StoreMapSectionProps> = ({
  address = 'In front of Tiwari Hotel, near Punjab National Bank, Renukoot, Sonbhadra, Uttar Pradesh 231217, India',
  phone = '+91 80905 29971',
  whatsapp = '+918090529971',
  openingHours = 'Daily: 10:00 AM – 10:00 PM',
  googleMapsUrl = "https://www.google.com/maps/place/Lovey's+Bakery+%26+Pizza+Corners/",
  compact = false,
}) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [infoOpen, setInfoOpen] = useState(true);
  const [originInput, setOriginInput] = useState('Hindalco Colony, Renukoot');
  const [routeTrigger, setRouteTrigger] = useState(0);
  const [routeInfo, setRouteInfo] = useState<{
    distanceText: string;
    durationText: string;
  } | null>(null);

  return (
    <div className="bg-white border border-[#E6D7C8] rounded-3xl overflow-hidden shadow-sm">
      <div className={`grid grid-cols-1 ${compact ? 'lg:grid-cols-12' : 'lg:grid-cols-12'}`}>
        {/* Left: Store Details & Directions Calculator */}
        <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[#E6D7C8] bg-[#FFF8F1]/60">
          <div className="space-y-5">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[#B94E62] font-semibold mb-1.5">
                Visit Our Renukoot Flagship Bakery
              </p>
              <h3 className="font-serif text-2xl sm:text-3xl font-bold text-[#3B2824]">
                Lovey&apos;s Bakery &amp; Pizza Corners
              </h3>
              <p className="text-sm text-[#6B544E] mt-0.5 font-medium">
                लवी&apos;स बेकरी &amp; पिज्जा कॉर्नर्स
              </p>
            </div>

            <div className="space-y-3.5 text-sm text-[#3B2824]">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[#B94E62] shrink-0 mt-1" />
                <div>
                  <p className="font-semibold">Store Address &amp; Landmark</p>
                  <p className="text-[#6B544E] leading-relaxed">{address}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-[#B94E62] shrink-0 mt-1" />
                <div>
                  <p className="font-semibold">Baking &amp; Dining Hours</p>
                  <p className="text-[#6B544E]">{openingHours}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-[#B94E62] shrink-0 mt-1" />
                <div>
                  <p className="font-semibold">Direct Phone &amp; WhatsApp Desk</p>
                  <p className="text-[#6B544E] font-mono-num">{phone}</p>
                </div>
              </div>
            </div>

            {/* Live Route Preview Calculator inside Map */}
            <div className="pt-4 border-t border-[#E6D7C8] space-y-2.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B544E]">
                Preview Driving Route in Renukoot / Sonbhadra
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={originInput}
                  onChange={(e) => setOriginInput(e.target.value)}
                  placeholder="Enter locality (e.g. Hindalco Colony, Pipri)"
                  className="flex-1 px-3.5 py-2 text-sm rounded-xl border border-[#E6D7C8] bg-white text-[#3B2824] focus:outline-none focus:border-[#B94E62]"
                />
                <button
                  type="button"
                  onClick={() => setRouteTrigger((prev) => prev + 1)}
                  className="px-3.5 py-2 rounded-xl bg-[#3B2824] text-[#FFF8F1] text-xs font-semibold whitespace-nowrap shrink-0 hover:bg-[#B94E62] transition-colors flex items-center gap-1.5"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  Plot Route
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {RENUKOOT_LANDMARKS.map((lm) => (
                  <button
                    key={lm.label}
                    type="button"
                    onClick={() => {
                      setOriginInput(lm.query);
                      setRouteTrigger((prev) => prev + 1);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white border border-[#E6D7C8] hover:border-[#B94E62] text-[11px] font-medium text-[#3B2824] transition-colors"
                  >
                    From {lm.label}
                  </button>
                ))}
              </div>

              {routeInfo && (
                <p className="mt-1 text-xs text-[#2D6A4F] font-medium font-mono-num">
                  Estimated Drive: {routeInfo.distanceText} · {routeInfo.durationText} to Lovey&apos;s
                </p>
              )}
            </div>
          </div>

          {/* Direct Action Buttons */}
          <div className="pt-6 mt-6 border-t border-[#E6D7C8] flex flex-wrap gap-2.5">
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl bg-[#B94E62] text-white text-xs font-semibold whitespace-nowrap shrink-0 hover:bg-[#9E3D50] transition-colors inline-flex items-center gap-1.5"
            >
              <Navigation className="w-3.5 h-3.5" />
              Open in Google Maps
            </a>
            <a
              href={`tel:${phone.replace(/\s+/g, '')}`}
              className="px-4 py-2.5 rounded-xl bg-[#3B2824] text-[#FFF8F1] text-xs font-semibold whitespace-nowrap shrink-0 hover:bg-[#523934] transition-colors inline-flex items-center gap-1.5"
            >
              <Phone className="w-3.5 h-3.5" />
              Call Store
            </a>
            <a
              href={`https://wa.me/${whatsapp.replace(/[^\d]/g, '')}?text=${encodeURIComponent(
                "Hello Lovey's Bakery & Pizza Corners! I would like to inquire about an order."
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl border border-[#3B2824] text-[#3B2824] text-xs font-semibold whitespace-nowrap shrink-0 hover:bg-[#F5EBE1] transition-colors inline-flex items-center gap-1.5"
            >
              WhatsApp Desk
            </a>
          </div>
        </div>

        {/* Right: Interactive 3D-Capable Google Map Canvas */}
        <div className="lg:col-span-7 min-h-[380px] sm:min-h-[460px] relative bg-[#F5EBE1]">
          {API_KEY ? (
            <APIProvider apiKey={API_KEY}>
              <Map
                mapId="DEMO_MAP_ID"
                defaultCenter={LOVEYS_COORDS}
                defaultZoom={16}
                gestureHandling="cooperative"
                disableDefaultUI={false}
                internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                className="w-full h-full min-h-[380px] sm:min-h-[460px]"
              >
                <AdvancedMarker
                  ref={markerRef}
                  position={LOVEYS_COORDS}
                  title="Lovey's Bakery & Pizza Corners"
                  onClick={() => setInfoOpen((prev) => !prev)}
                >
                  <Pin
                    background="#B94E62"
                    borderColor="#3B2824"
                    glyphColor="#FFF8F1"
                    scale={1.2}
                  />
                </AdvancedMarker>

                {infoOpen && marker && (
                  <InfoWindow
                    anchor={marker}
                    onCloseClick={() => setInfoOpen(false)}
                  >
                    <div className="p-1.5 max-w-[230px] text-[#3B2824]">
                      <p className="font-serif font-bold text-sm">
                        Lovey&apos;s Bakery &amp; Pizza Corners
                      </p>
                      <p className="text-[11px] text-[#6B544E] mt-0.5">
                        In front of Tiwari Hotel, near Punjab National Bank, Renukoot (231217)
                      </p>
                      <div className="mt-2 flex items-center justify-between text-[11px] font-semibold">
                        <span className="text-[#2D6A4F]">Open Daily · 9 AM–10:30 PM</span>
                        <a
                          href={googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#B94E62] underline"
                        >
                          Directions
                        </a>
                      </div>
                    </div>
                  </InfoWindow>
                )}

                <RoutePolylineOverlay
                  destination={LOVEYS_COORDS}
                  originQuery={originInput}
                  triggerId={routeTrigger}
                  onRouteInfo={setRouteInfo}
                />
              </Map>
            </APIProvider>
          ) : (
            <div className="w-full h-full min-h-[380px] flex flex-col items-center justify-center p-8 text-center">
              <MapPin className="w-10 h-10 text-[#B94E62] mb-3" />
              <p className="font-serif text-xl font-bold text-[#3B2824]">
                Lovey&apos;s Bakery &amp; Pizza Corners — Renukoot
              </p>
              <p className="text-sm text-[#6B544E] max-w-md mt-1 mb-4">
                {address}
              </p>
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 rounded-xl bg-[#B94E62] text-white text-xs font-semibold hover:bg-[#9E3D50] transition-colors inline-flex items-center gap-1.5"
              >
                Open Store Location on Google Maps
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
