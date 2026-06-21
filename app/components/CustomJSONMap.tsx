import { useEffect } from "react";
import { MapContainer, TileLayer, WMSTileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const mapZoom = 13;

function MapRecenter({
  center,
  zoom,
}: {
  center: [number, number];
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.5 });
  }, [center, zoom, map]);
  return null;
}

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(map.getContainer());
    return () => resizeObserver.disconnect();
  }, [map]);
  return null;
}

function MapInstanceReporter({
  onMapLoad,
}: {
  onMapLoad?: (map: any) => void;
}) {
  const map = useMap();
  useEffect(() => {
    if (onMapLoad) {
      onMapLoad(map);
    }
  }, [map, onMapLoad]);
  return null;
}

// --- UPDATE INTERFACE: Tambah colorMode dan hasMorphology ---
interface CustomMapProps {
  scale: string;
  layerName: string;
  color: string;
  showLayer?: boolean;
  mapCenter: [number, number];
  onMapLoad?: (map: any) => void;
  colorMode?: string;
  hasMorphology?: boolean;
}

export default function CustomJSONMap({
  scale,
  layerName,
  color,
  showLayer = true,
  mapCenter,
  onMapLoad,
  colorMode = "plain",
  hasMorphology = false,
}: CustomMapProps) {
  const geoserverUrl =
    "https://dashboardgarispantai.my.id/geoserver/dashboard/wms";

  // --- LOGIKA PEMILIHAN STYLE (KUAS) GEOSERVER ---
  // Default: Polos (Biru/Hijau)
  let geoserverStyle = color === "green" ? "garis_hijau" : "line";

  // Jika tombol Morfologi ditekan DAN layer ini memang punya data morfologi
  if (colorMode === "morphology" && hasMorphology) {
    geoserverStyle = "style_morfologi"; // Pastikan nama ini sesuai dengan SLD di GeoServer Anda
  }

  return (
    <MapContainer
      center={mapCenter}
      zoom={mapZoom}
      scrollWheelZoom={true}
      style={{ height: "100vh", width: "100%" }}
      zoomControl={false}
    >
      <MapRecenter center={mapCenter} zoom={mapZoom} />
      <MapResizer />
      <MapInstanceReporter onMapLoad={onMapLoad} />

      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {showLayer && layerName && (
        <WMSTileLayer
          key={`${layerName}_${geoserverStyle}`} // Key diubah agar peta re-render saat warna diganti
          url={geoserverUrl}
          layers={layerName}
          format="image/png"
          transparent={true}
          styles={geoserverStyle}
        />
      )}
    </MapContainer>
  );
}
