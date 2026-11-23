import React, { useState } from 'react';
import {
  MapPin,
  Phone,
  Navigation,
  Clock,
  ExternalLink,
  Compass,
  CheckCircle2,
  Star,
} from 'lucide-react';

export const LOVEYS_COORDS = {
  lat: 24.2054,
  lng: 83.0355,
};

const LOVEYS_MAPS_DESTINATION =
  "Lovey's Bakery & Pizza Corners, In front of Tiwari Hotel, near Punjab National Bank, Renukoot, Sonbhadra, Uttar Pradesh 231217, India";

const RENUKOOT_LANDMARKS = [
  {
    label: 'Hindalco Colony',
    query: 'Hindalco Colony, Renukoot',
    routeHint:
      'Follow the main Renukoot Market Road towards Punjab National Bank (PNB), directly in front of Tiwari Hotel.',
  },
  {
    label: 'Murdhawa Market',
    query: 'Murdhawa, Renukoot',
    routeHint:
      'Proceed along NH-39 Main Market Road past Hindalco Hospital towards Punjab National Bank and Tiwari Hotel.',
  },
  {
    label: 'Pipri / Rihand Road',
    query: 'Pipri, Sonbhadra',
    routeHint:
      'Head along Pipri–Renukoot Main Road into Renukoot Main Market, opposite Tiwari Hotel near Punjab National Bank.',
  },
  {
    label: 'Renukoot Railway Station',
    query: 'Renukoot Railway Station',
    routeHint:
      'Exit the station road onto Renukoot Main Market Road, located in front of Tiwari Hotel near Punjab National Bank.',
  },
];

interface StoreMapSectionProps {
  address?: string;
  phone?: string;
  whatsapp?: string;
  openingHours?: string;
  googleMapsUrl?: string;
  googleReviewUrl?: string;
  coordinatesLat?: number;
  coordinatesLng?: number;
  coordinatesVerifiedByOwner?: boolean;
  openingHoursVerifiedByOwner?: boolean;
  compact?: boolean;
}

export const StoreMapSection: React.FC<StoreMapSectionProps> = ({
  address = 'In front of Tiwari Hotel, near Punjab National Bank, Renukoot, Sonbhadra, Uttar Pradesh 231217, India',
  phone = '+91 80905 29971',
  whatsapp = '+918090529971',
  openingHours = 'Daily: 10:00 AM – 10:00 PM (Confirm holiday hours with store)',
  googleMapsUrl = "https://www.google.com/maps/place/Lovey's+Bakery+%26+Pizza+Corners/",
  googleReviewUrl = '',
  coordinatesLat = LOVEYS_COORDS.lat,
  coordinatesLng = LOVEYS_COORDS.lng,
  coordinatesVerifiedByOwner = false,
  openingHoursVerifiedByOwner = false,
  compact = false,
}) => {
  const [originInput, setOriginInput] = useState('Hindalco Colony, Renukoot');
  const [selectedLandmark, setSelectedLandmark] = useState(RENUKOOT_LANDMARKS[0]);

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    `${originInput.trim() || 'Renukoot'}, Sonbhadra, Uttar Pradesh, India`
  )}&destination=${encodeURIComponent(LOVEYS_MAPS_DESTINATION)}&travelmode=driving`;

  return (
    <div className="bg-white border border-[#E6D7C8] rounded-3xl overflow-hidden shadow-sm">
      <div className={`grid grid-cols-1 ${compact ? 'lg:grid-cols-12' : 'lg:grid-cols-12'}`}>
        {/* Left: Store Details & Directions Planner */}
        <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[#E6D7C8] bg-[#FFF8F1]/60">
          <div className="space-y-5">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[#B94E62] font-semibold mb-1.5">
                Visit Our Renukoot Bakery &amp; Café
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
                  <p className="font-semibold">
                    Store &amp; Ordering Hours{' '}
                    {openingHoursVerifiedByOwner ? (
                      <span className="text-[10px] font-bold uppercase text-[#2D6A4F] ml-1">
                        (Owner Verified)
                      </span>
                    ) : null}
                  </p>
                  <p className="text-[#6B544E]">{openingHours}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-[#B94E62] shrink-0 mt-1" />
                <div>
                  <p className="font-semibold">Direct Phone &amp; WhatsApp Desk</p>
                  <p className="text-[#6B544E] font-mono-num">
                    <a href={`tel:${phone.replace(/\s+/g, '')}`} className="hover:underline">
                      {phone}
                    </a>
                  </p>
                </div>
              </div>
            </div>

            {/* Turn-by-Turn Route Planner */}
            <div className="pt-4 border-t border-[#E6D7C8] space-y-2.5">
              <label
                htmlFor="store-route-origin-input"
                className="block text-xs font-semibold uppercase tracking-wider text-[#6B544E]"
              >
                Get Driving Directions in Renukoot / Sonbhadra
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="store-route-origin-input"
                  type="text"
                  value={originInput}
                  onChange={(e) => {
                    setOriginInput(e.target.value);
                    const matched = RENUKOOT_LANDMARKS.find(
                      (lm) =>
                        lm.query.toLowerCase() === e.target.value.toLowerCase() ||
                        lm.label.toLowerCase() === e.target.value.toLowerCase()
                    );
                    if (matched) setSelectedLandmark(matched);
                  }}
                  placeholder="Enter locality (e.g. Hindalco Colony, Pipri)"
                  className="flex-1 min-w-0 px-3.5 py-2 text-sm rounded-xl border border-[#E6D7C8] bg-white text-[#3B2824] focus:outline-none focus:border-[#B94E62]"
                />
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2.5 sm:py-2 rounded-xl bg-[#3B2824] text-[#FFF8F1] text-xs font-semibold whitespace-nowrap shrink-0 hover:bg-[#B94E62] transition-colors flex items-center justify-center gap-1.5"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  Directions
                </a>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {RENUKOOT_LANDMARKS.map((lm) => {
                  const isSelected = selectedLandmark.label === lm.label;
                  return (
                    <button
                      key={lm.label}
                      type="button"
                      onClick={() => {
                        setOriginInput(lm.query);
                        setSelectedLandmark(lm);
                      }}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors ${
                        isSelected
                          ? 'bg-[#3B2824] text-[#FFF8F1] border-[#3B2824]'
                          : 'bg-white border-[#E6D7C8] hover:border-[#B94E62] text-[#3B2824]'
                      }`}
                    >
                      From {lm.label}
                    </button>
                  );
                })}
              </div>

              <p className="mt-1 text-xs text-[#2D6A4F] font-medium">
                Landmark Route from {selectedLandmark.label}: Opposite Tiwari Hotel, near Punjab
                National Bank, Renukoot Main Market
              </p>
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
            {googleReviewUrl && googleReviewUrl.trim().startsWith('http') && (
              <a
                href={googleReviewUrl.trim()}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl border border-[#E5B867] bg-[#FFF8F1] text-[#3B2824] text-xs font-semibold whitespace-nowrap shrink-0 hover:border-[#B94E62] transition-colors inline-flex items-center gap-1.5"
              >
                <Star className="w-3.5 h-3.5 text-[#E5B867]" />
                Review Us on Google
              </a>
            )}
          </div>
        </div>

        {/* Right: Key-Free Interactive Landmark & Turn-by-Turn Navigation Guide */}
        <div className="lg:col-span-7 min-h-[380px] sm:min-h-[460px] relative bg-gradient-to-br from-[#FFF8F1] via-[#F5EBE1] to-[#EADACA] p-6 sm:p-8 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="px-3 py-1 rounded-lg bg-[#3B2824] text-[#E5B867] text-[11px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" />
              Renukoot Main Market Landmark Guide
            </span>
            <span className="px-3 py-1 rounded-lg bg-white/90 border border-[#E6D7C8] text-[11px] font-mono-num font-semibold text-[#3B2824]">
              {coordinatesVerifiedByOwner
                ? `Verified Pin: ${coordinatesLat}° N, ${coordinatesLng}° E · PIN 231217`
                : 'Renukoot, Sonbhadra · PIN 231217'}
            </span>
          </div>

          {/* Central Landmark Map Card */}
          <div className="my-6 bg-white/95 border-2 border-[#E6D7C8] rounded-3xl p-6 shadow-md space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#B94E62] text-white flex items-center justify-center shrink-0 shadow-sm">
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-[#2D6A4F] flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Official Renukoot Bakery &amp; Café Location
                  </span>
                  <h4 className="font-serif text-xl sm:text-2xl font-bold text-[#3B2824] mt-0.5">
                    Lovey&apos;s Bakery &amp; Pizza Corners
                  </h4>
                  <p className="text-xs text-[#6B544E] mt-1 leading-relaxed">{address}</p>
                </div>
              </div>
            </div>

            {/* Active Route Preview Box */}
            <div className="p-4 rounded-2xl bg-[#FFF8F1] border border-[#E6D7C8] space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#3B2824]">
                  Selected Route: {originInput || selectedLandmark.label} &rarr; Lovey&apos;s Bakery
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-[#E8F5E9] text-[#2D6A4F] text-xs font-bold">
                  Live Google Maps Turn-by-Turn
                </span>
              </div>
              <p className="text-xs text-[#6B544E]">{selectedLandmark.routeHint}</p>
            </div>

            {/* Nearby Landmarks Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-[#FFF8F1]/70 border border-[#E6D7C8]">
                <span className="text-[10px] font-bold uppercase text-[#B94E62] block">
                  Opposite Landmark
                </span>
                <span className="font-bold text-[#3B2824]">In Front of Tiwari Hotel</span>
              </div>
              <div className="p-3 rounded-xl bg-[#FFF8F1]/70 border border-[#E6D7C8]">
                <span className="text-[10px] font-bold uppercase text-[#B94E62] block">
                  Adjacent Bank
                </span>
                <span className="font-bold text-[#3B2824]">Near Punjab National Bank</span>
              </div>
              <div className="p-3 rounded-xl bg-[#FFF8F1]/70 border border-[#E6D7C8]">
                <span className="text-[10px] font-bold uppercase text-[#B94E62] block">
                  Service Coverage
                </span>
                <span className="font-bold text-[#3B2824]">Confirmed Renukoot PIN Zones</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto max-w-full px-5 py-2.5 rounded-xl bg-[#3B2824] text-[#FFF8F1] text-xs font-semibold hover:bg-[#B94E62] transition-colors inline-flex items-center justify-center gap-2 text-center"
            >
              <Navigation className="w-3.5 h-3.5 text-[#E5B867] shrink-0" />
              <span className="truncate">Launch Turn-by-Turn Route from {originInput || 'Your Location'}</span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </a>

            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white border border-[#E6D7C8] text-[#3B2824] text-xs font-semibold hover:border-[#B94E62] transition-colors inline-flex items-center justify-center gap-1.5"
            >
              View Store Pin on Google Maps
              <ExternalLink className="w-3.5 h-3.5 text-[#B94E62] shrink-0" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
