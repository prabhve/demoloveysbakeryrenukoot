import React, { useState } from 'react';
import {
  MapPin,
  Phone,
  Navigation,
  Clock,
  ExternalLink,
  Compass,
  CheckCircle2,
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
    distanceText: '1.8 km',
    durationText: '5 mins drive',
    routeHint: 'Via Main Renukoot–Varanasi Highway towards Punjab National Bank & Tiwari Hotel',
  },
  {
    label: 'Murdhawa Market',
    query: 'Murdhawa, Renukoot',
    distanceText: '2.6 km',
    durationText: '7 mins drive',
    routeHint: 'Straight along NH-39 Main Market Road past Hindalco Hospital towards PNB',
  },
  {
    label: 'Pipri / Rihand Road',
    query: 'Pipri, Sonbhadra',
    distanceText: '5.4 km',
    durationText: '12 mins drive',
    routeHint: 'Via Pipri Main Road into Renukoot Market, opposite Tiwari Hotel',
  },
  {
    label: 'Renukoot Railway Station',
    query: 'Renukoot Railway Station',
    distanceText: '1.2 km',
    durationText: '4 mins drive',
    routeHint: 'Exit station road onto Main Market Road, right in front of Tiwari Hotel near PNB',
  },
];

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
  const [originInput, setOriginInput] = useState('Hindalco Colony, Renukoot');
  const [selectedLandmark, setSelectedLandmark] = useState(RENUKOOT_LANDMARKS[0]);

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    `${originInput.trim() || 'Renukoot'}, Sonbhadra, Uttar Pradesh, India`
  )}&destination=${encodeURIComponent(LOVEYS_MAPS_DESTINATION)}&travelmode=driving`;

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

            {/* Turn-by-Turn Route Planner */}
            <div className="pt-4 border-t border-[#E6D7C8] space-y-2.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B544E]">
                Get Driving Directions in Renukoot / Sonbhadra
              </label>
              <div className="flex gap-2">
                <input
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
                  className="flex-1 px-3.5 py-2 text-sm rounded-xl border border-[#E6D7C8] bg-white text-[#3B2824] focus:outline-none focus:border-[#B94E62]"
                />
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-[#3B2824] text-[#FFF8F1] text-xs font-semibold whitespace-nowrap shrink-0 hover:bg-[#B94E62] transition-colors flex items-center gap-1.5"
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

              <p className="mt-1 text-xs text-[#2D6A4F] font-medium font-mono-num">
                Estimated Drive from {selectedLandmark.label}: {selectedLandmark.distanceText} ·{' '}
                {selectedLandmark.durationText}
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
              GPS: {LOVEYS_COORDS.lat}° N, {LOVEYS_COORDS.lng}° E · PIN 231217
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
                    Verified Flagship Store Location
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
                <span className="px-2.5 py-0.5 rounded-md bg-[#E8F5E9] text-[#2D6A4F] font-mono-num text-xs font-bold">
                  {selectedLandmark.distanceText} · {selectedLandmark.durationText}
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
                  Delivery Radius
                </span>
                <span className="font-bold text-[#3B2824]">Renukoot, Murdhawa &amp; Pipri</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-xl bg-[#3B2824] text-[#FFF8F1] text-xs font-semibold hover:bg-[#B94E62] transition-colors inline-flex items-center gap-2"
            >
              <Navigation className="w-3.5 h-3.5 text-[#E5B867]" />
              Launch Turn-by-Turn Route from {originInput || 'Your Location'}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl bg-white border border-[#E6D7C8] text-[#3B2824] text-xs font-semibold hover:border-[#B94E62] transition-colors inline-flex items-center gap-1.5"
            >
              View Store Pin on Google Maps
              <ExternalLink className="w-3.5 h-3.5 text-[#B94E62]" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
