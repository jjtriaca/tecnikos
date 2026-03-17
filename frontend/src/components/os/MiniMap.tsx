"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MiniMapProps {
  destLat: number;
  destLng: number;
  techLat?: number;
  techLng?: number;
  techHeading?: number;
}

// Smaller destination icon (18x24 instead of 24x32)
const DEST_ICON = L.divIcon({
  className: "",
  html: `<svg width="16" height="22" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z" fill="#EF4444"/>
    <circle cx="12" cy="11" r="5" fill="white"/>
  </svg>`,
  iconSize: [16, 22],
  iconAnchor: [8, 22],
});

function createTechIcon(heading?: number) {
  const rotation = heading != null ? heading : 0;
  return L.divIcon({
    className: "",
    html: `<div style="transform:rotate(${rotation}deg);display:flex;align-items:center;justify-content:center;">
      <svg width="18" height="18" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="14" cy="14" r="12" fill="#3B82F6" stroke="white" stroke-width="3"/>
        <path d="M14 6 L18 16 L14 14 L10 16 Z" fill="white" opacity="0.9"/>
      </svg>
    </div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

// Calculate distance between two points in meters
function distanceBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function MiniMap({ destLat, destLng, techLat, techLng, techHeading }: MiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const techMarkerRef = useRef<L.Marker | null>(null);
  const lineRef = useRef<L.Polyline | null>(null);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      boxZoom: false,
      keyboard: false,
    }).setView([destLat, destLng], 15);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
    }).addTo(map);

    mapRef.current = map;

    // Destination marker
    destMarkerRef.current = L.marker([destLat, destLng], { icon: DEST_ICON }).addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      destMarkerRef.current = null;
      techMarkerRef.current = null;
      lineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers on data change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Update dest marker position
    if (destMarkerRef.current) {
      destMarkerRef.current.setLatLng([destLat, destLng]);
    }

    // Update or create tech marker
    if (techLat != null && techLng != null) {
      if (techMarkerRef.current) {
        techMarkerRef.current.setLatLng([techLat, techLng]);
        techMarkerRef.current.setIcon(createTechIcon(techHeading));
      } else {
        techMarkerRef.current = L.marker([techLat, techLng], {
          icon: createTechIcon(techHeading),
        }).addTo(map);
      }

      // Draw/update dashed line between tech and dest
      const points: L.LatLngExpression[] = [
        [techLat, techLng],
        [destLat, destLng],
      ];
      if (lineRef.current) {
        lineRef.current.setLatLngs(points);
      } else {
        lineRef.current = L.polyline(points, {
          color: "#6366F1",
          weight: 2,
          dashArray: "6 4",
          opacity: 0.7,
        }).addTo(map);
      }

      // Smart zoom: closer distance = higher zoom
      const dist = distanceBetween(techLat, techLng, destLat, destLng);
      let minZoom = 14;
      if (dist < 200) minZoom = 17;
      else if (dist < 500) minZoom = 16;
      else if (dist < 1000) minZoom = 15;

      const bounds = L.latLngBounds([
        [techLat, techLng],
        [destLat, destLng],
      ]);
      map.fitBounds(bounds, { padding: [15, 15], maxZoom: 17, animate: true });

      // Ensure minimum zoom for close distances
      setTimeout(() => {
        if (map.getZoom() < minZoom) {
          map.setZoom(minZoom, { animate: true });
        }
      }, 100);
    } else {
      // No tech location — center on dest
      map.setView([destLat, destLng], 15, { animate: true });

      // Remove tech marker and line if they exist
      if (techMarkerRef.current) {
        techMarkerRef.current.remove();
        techMarkerRef.current = null;
      }
      if (lineRef.current) {
        lineRef.current.remove();
        lineRef.current = null;
      }
    }
  }, [destLat, destLng, techLat, techLng, techHeading]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded overflow-hidden"
      style={{ height: 180 }}
    />
  );
}
