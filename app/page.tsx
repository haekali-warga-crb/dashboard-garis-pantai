"use client";

import { useState, useEffect, useRef, memo } from "react";
import dynamic from "next/dynamic";
import {
  Map,
  Layers,
  Info,
  Download,
  Settings,
  ChevronRight,
  Eye,
  EyeOff,
  Palette,
  AlertTriangle,
  Loader2,
  Brain,
} from "lucide-react";

const CustomJSONMap = dynamic(() => import("./components/CustomJSONMap"), {
  ssr: false,
});
import { REGION_CONFIG } from "./config/regionData";

// === ARRAY UNTUK PENGECEKAN DINAMIS ===
const ALL_LAYERS_ARRAY = [
  "dashboard:bitung_5k_sumber",
  "dashboard:bitung_25k_hasil",
  "dashboard:nusa_tenggara_5k_sumber",
  "dashboard:togean_5k_sumber",
  "dashboard:togean_25k_sumber",
  "dashboard:togean_25k_hasil",
  "dashboard:togean_50k_sumber",
  "dashboard:togean_50k_hasil",
  "dashboard:togean_250k_sumber",
  "dashboard:togean_250k_hasil",
  "dashboard:togean_500k_sumber",
  "dashboard:togean_500k_hasil",
  "dashboard:togean_1000k_hasil",
];

const CLASSIFIED_LAYERS = [
  "bitung_5k_sumber",
  "bitung_25k_hasil",
  "togean_5k_sumber",
  "togean_25k_sumber",
  "togean_25k_hasil",
  "togean_50k_sumber",
  "togean_50k_hasil",
  "togean_250k_sumber",
  "togean_250k_hasil",
  "togean_500k_sumber",
  "togean_500k_hasil",
  "togean_1000k_hasil",
];

// --- KODE BARU (Dioptimasi) ---
const AttributeTable = memo(function AttributeTable({
  rows,
  loading,
  error,
  hiddenColumns,
  accentClass,
}) {
  if (loading)
    return (
      <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
        Memuat data atribut dari GeoServer...
      </div>
    );
  if (error)
    return (
      <div className="flex items-center justify-center h-24 text-red-500 text-xs px-2">
        Gagal memuat: {error}
      </div>
    );
  if (rows.length === 0)
    return (
      <div className="flex items-center justify-center h-24 text-gray-400 text-sm italic">
        Tidak ada data atribut untuk layer ini.
      </div>
    );

  const columns = Object.keys(rows[0]).filter(
    (col) => !hiddenColumns.includes(col.toLowerCase()),
  );

  return (
    <div className="overflow-auto max-h-48 text-xs border border-gray-200 rounded">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 bg-gray-100 shadow-sm z-10">
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                className={`px-3 py-2 text-left font-semibold border-b border-r border-gray-200 whitespace-nowrap ${accentClass}`}
              >
                {col.toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={`hover:bg-gray-100 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
            >
              {columns.map((col) => (
                <td
                  key={col}
                  className="px-3 py-2 border-b border-r border-gray-100 text-gray-700 whitespace-nowrap max-w-xs truncate"
                  title={String(row[col] ?? "")}
                >
                  {row[col] !== null && row[col] !== undefined
                    ? String(row[col])
                    : "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

const CoastlineDashboard = () => {
  const [region, setRegion] = useState("togean");
  const [sourceScale, setSourceScale] = useState("1:5.000");
  const [targetScale, setTargetScale] = useState("1:25.000");
  const [showBefore, setShowBefore] = useState(true);
  const [showAfter, setShowAfter] = useState(true);
  const [activePanel, setActivePanel] = useState("metadata");
  const [colorMode, setColorMode] = useState("plain");
  const [splitPosition, setSplitPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [leftMap, setLeftMap] = useState(null);
  const [rightMap, setRightMap] = useState(null);
  const isFlying = useRef(false);

  const [sourceAttrs, setSourceAttrs] = useState([]);
  const [targetAttrs, setTargetAttrs] = useState([]);
  const [attrsLoading, setAttrsLoading] = useState(false);
  const [attrsError, setAttrsError] = useState(null);
  const [layerAvailability, setLayerAvailability] = useState({
    source: true,
    target: true,
  });
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    title: "",
    message: "",
  });
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  // === SOLUSI FLYTO (Pencegahan Race Condition) ===
  const handleRegionChange = (e) => {
    // Kunci sinkronisasi secara kilat sebelum peta sempat bergerak
    isFlying.current = true;

    const newRegion = e.target.value;
    setRegion(newRegion);

    const config = REGION_CONFIG[newRegion];
    if (!config.availableScales.includes(sourceScale))
      setSourceScale(config.availableScales[0]);
    if (!config.targetScales.includes(targetScale))
      setTargetScale(config.targetScales[0]);

    // Buka kembali kunci sinkronisasi setelah durasi flyTo (1.5s) dijamin selesai
    setTimeout(() => {
      isFlying.current = false;
    }, 2500);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const container = document.getElementById("split-map-container");
      if (container) {
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
        setSplitPosition(percentage);
      }
    };
    const handleMouseUp = () => setIsDragging(false);
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const formatScaleToLayer = (scale) => {
    const scaleMap = {
      "1:5.000": "5k",
      "1:25.000": "25k",
      "1:50.000": "50k",
      "1:250.000": "250k",
      "1:500.000": "500k",
      "1:1.000.000": "1000k",
    };
    return scaleMap[scale] || "5k";
  };

  const checkHasMorphology = (fullLayerName) => {
    const cleanName = fullLayerName.replace("dashboard:", "");
    return CLASSIFIED_LAYERS.includes(cleanName);
  };

  const sourceLayerName = `dashboard:${region}_${formatScaleToLayer(sourceScale)}_sumber`;
  const targetLayerName = `dashboard:${region}_${formatScaleToLayer(targetScale)}_hasil`;
  const sourceZipName = `${region}_${formatScaleToLayer(sourceScale)}_sumber.gpkg`;
  const targetZipName = `${region}_${formatScaleToLayer(targetScale)}_hasil.gpkg`;

  useEffect(() => {
    if (!leftMap || !rightMap) return;
    let isSyncingLeft = false;
    let isSyncingRight = false;
    const syncLeftToRight = () => {
      if (isFlying.current || isSyncingLeft) return;
      isSyncingRight = true;
      const center = leftMap.getCenter();
      const zoom = leftMap.getZoom();
      if (
        center.distanceTo(rightMap.getCenter()) > 1 ||
        zoom !== rightMap.getZoom()
      ) {
        rightMap.setView(center, zoom, { animate: false });
      }
      isSyncingRight = false;
    };
    const syncRightToLeft = () => {
      if (isFlying.current || isSyncingRight) return;
      isSyncingLeft = true;
      const center = rightMap.getCenter();
      const zoom = rightMap.getZoom();
      if (
        center.distanceTo(leftMap.getCenter()) > 1 ||
        zoom !== leftMap.getZoom()
      ) {
        leftMap.setView(center, zoom, { animate: false });
      }
      isSyncingLeft = false;
    };
    leftMap.on("move", syncLeftToRight);
    rightMap.on("move", syncRightToLeft);
    return () => {
      leftMap.off("move", syncLeftToRight);
      rightMap.off("move", syncRightToLeft);
    };
  }, [leftMap, rightMap]);

  const HIDDEN_COLUMNS = [
    "geom",
    "geometry",
    "the_geom",
    "wkb_geometry",
    "ogc_fid",
    "id",
    "fid",
    "bbox",
  ];

  useEffect(() => {
    if (!sourceLayerName || !targetLayerName) return;
    const fetchAttributes = async (layerName) => {
      try {
        const url = `https://helped-prague-synthesis-ryan.trycloudflare.com/geoserver/dashboard/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=${layerName}&outputFormat=application/json&maxFeatures=500`;
        const res = await fetch(url, {
          headers: {
            "ngrok-skip-browser-warning": "true",
          },
        });
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json"))
          return null;
        const json = await res.json();
        return (json.features ?? []).map((f) => f.properties ?? {});
      } catch (error) {
        return null;
      }
    };

    setAttrsLoading(true);
    setAttrsError(null);
    Promise.all([
      fetchAttributes(sourceLayerName),
      fetchAttributes(targetLayerName),
    ])
      .then(([src, tgt]) => {
        setLayerAvailability({ source: src !== null, target: tgt !== null });
        setSourceAttrs(src || []);
        setTargetAttrs(tgt || []);
      })
      .catch(() =>
        setAttrsError("Terjadi hambatan komunikasi dengan GeoServer."),
      )
      .finally(() => setAttrsLoading(false));
  }, [sourceLayerName, targetLayerName]);

  const handleDynamicDownloadAll = async () => {
    setIsDownloadingAll(true);
    const availableLayers = [];
    try {
      const checkPromises = ALL_LAYERS_ARRAY.map(async (layer) => {
        try {
          const url = `https://helped-prague-synthesis-ryan.trycloudflare.com/geoserver/dashboard/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=${layer}&outputFormat=application/json&maxFeatures=1`;
          const res = await fetch(url, {
            headers: {
              "ngrok-skip-browser-warning": "true",
            },
          });
          const contentType = res.headers.get("content-type");
          if (
            res.ok &&
            contentType &&
            contentType.includes("application/json")
          ) {
            return layer;
          }
          return null;
        } catch (e) {
          return null;
        }
      });

      const results = await Promise.all(checkPromises);
      results.forEach((res) => {
        if (res) availableLayers.push(res);
      });

      if (availableLayers.length === 0) {
        setAlertModal({
          isOpen: true,
          title: "Dataset Kosong",
          message:
            "Belum ada satupun layer yang diunggah dan dipublikasikan di GeoServer.",
        });
        setIsDownloadingAll(false);
        return;
      }

      const compiledLayers = availableLayers.join(",");
      const downloadUrl = `https://helped-prague-synthesis-ryan.trycloudflare.com/geoserver/dashboard/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=${compiledLayers}&outputFormat=geopackage&format_options=filename:semua_data_capstone.gpkg`;

      const a = document.createElement("a");
      a.href = downloadUrl;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      setAlertModal({
        isOpen: true,
        title: "Terjadi Kesalahan",
        message: "Gagal memproses validasi unduhan dataset.",
      });
    } finally {
      setIsDownloadingAll(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 relative">
      {alertModal.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 border-t-4 border-red-500 transform transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 text-red-600 rounded-full flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                {alertModal.title}
              </h3>
            </div>
            <p className="text-gray-600 text-sm mb-6 leading-relaxed">
              {alertModal.message}
            </p>
            <div className="flex justify-end">
              <button
                onClick={() =>
                  setAlertModal({ isOpen: false, title: "", message: "" })
                }
                className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-medium transition-colors outline-none shadow-sm"
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-blue-900 text-white p-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Map className="w-8 h-8" />
            <div>
              <h1 className="text-2xl font-bold">
                Dashboard Generalisasi Garis Pantai
              </h1>
              <p className="text-sm text-blue-200">
                Visualisasi Multi-Skala Garis Pantai Indonesia
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <a
              href="/downloads/guidebook.pdf"
              download
              className="px-4 py-2 bg-blue-700 hover:bg-blue-600 rounded-lg transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Unduh GuideBook
            </a>
            <a
              href="/downloads/plugin_qgis.zip"
              download
              className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Plugin QGIS
            </a>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 bg-white shadow-lg overflow-y-auto">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5" /> Kontrol
            </h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pilih Wilayah
              </label>
              <select
                value={region}
                onChange={handleRegionChange}
                className="w-full px-3 py-2 border rounded-lg bg-white shadow-sm"
              >
                {Object.keys(REGION_CONFIG).map((regKey) => (
                  <option key={regKey} value={regKey}>
                    {REGION_CONFIG[regKey].label}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Skala Sumber
              </label>
              <select
                value={sourceScale}
                onChange={(e) => {
                  isFlying.current = true;
                  setSourceScale(e.target.value);
                  setTimeout(() => {
                    isFlying.current = false;
                  }, 1500);
                }}
                className="w-full px-3 py-2 border rounded-lg bg-blue-50"
              >
                {REGION_CONFIG[region].availableScales.map((scale) => (
                  <option key={scale} value={scale}>
                    {scale}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Skala Target
              </label>
              <select
                value={targetScale}
                onChange={(e) => {
                  isFlying.current = true;
                  setTargetScale(e.target.value);
                  setTimeout(() => {
                    isFlying.current = false;
                  }, 1500);
                }}
                className="w-full px-3 py-2 border rounded-lg bg-green-50"
              >
                {REGION_CONFIG[region].targetScales.map((scale) => (
                  <option key={scale} value={scale}>
                    {scale}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Palette className="w-4 h-4" /> Mode Pewarnaan
              </label>
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setColorMode("plain")}
                  className={`flex-1 text-xs py-2 px-3 rounded-md font-medium transition-colors ${colorMode === "plain" ? "bg-white shadow-sm text-blue-700" : "text-gray-500 hover:text-gray-700"}`}
                >
                  Warna Polos
                </button>
                <button
                  onClick={() => setColorMode("morphology")}
                  className={`flex-1 text-xs py-2 px-3 rounded-md font-medium transition-colors ${colorMode === "morphology" ? "bg-white shadow-sm text-purple-700" : "text-gray-500 hover:text-gray-700"}`}
                >
                  Tipe Morfologi
                </button>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tampilan Layer
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                  <input
                    type="checkbox"
                    checked={showBefore}
                    onChange={(e) => setShowBefore(e.target.checked)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="flex-1 text-sm">Data Sebelum (Sumber)</span>
                  {showBefore ? (
                    <Eye className="w-4 h-4 text-blue-600" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-gray-400" />
                  )}
                </label>
                <label className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                  <input
                    type="checkbox"
                    checked={showAfter}
                    onChange={(e) => setShowAfter(e.target.checked)}
                    className="w-4 h-4 text-green-600"
                  />
                  <span className="flex-1 text-sm">Data Sesudah (Target)</span>
                  {showAfter ? (
                    <Eye className="w-4 h-4 text-green-600" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-gray-400" />
                  )}
                </label>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Perbandingan Split-Screen
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={splitPosition}
                onChange={(e) => setSplitPosition(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Sebelum</span>
                <span>{splitPosition.toFixed(0)}%</span>
                <span>Sesudah</span>
              </div>
            </div>
            <div className="mt-6 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4" /> Legenda
              </h3>
              {colorMode === "plain" ? (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-1 bg-blue-600"></div>
                    <span>Sumber (Polos)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-1 bg-green-600"></div>
                    <span>Target (Polos)</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <p className="text-xs text-gray-500 mb-2 italic">
                    *Jika layer mendukung klasifikasi morfologi
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-1 bg-[#e41a1c]"></div>
                    <span className="text-xs">Orthogonal</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-1 bg-[#377eb8]"></div>
                    <span className="text-xs">Smooth</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-1 bg-[#4daf4a]"></div>
                    <span className="text-xs">Rugged</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-1 bg-[#984ea3]"></div>
                    <span className="text-xs">Broad</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-1 bg-[#ff7f00]"></div>
                    <span className="text-xs">Elongated</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 relative bg-gray-100">
            <div
              id="split-map-container"
              className="absolute inset-0 flex items-center justify-center"
            >
              <div
                className={`relative w-full h-full flex ${isDragging ? "cursor-ew-resize" : ""}`}
              >
                <div
                  className={`h-full relative overflow-hidden border-r border-blue-400 ${isDragging ? "pointer-events-none" : ""}`}
                  style={{ width: `${splitPosition}%` }}
                >
                  {/* PENAMBAHAN POINTER-EVENTS-NONE UNTUK SOLUSI PANNING PETA */}
                  {!layerAvailability.source && !attrsLoading && (
                    <div className="absolute inset-0 z-[50] flex flex-col items-center justify-center bg-gray-100/60 backdrop-blur-[2px] pointer-events-none">
                      <div className="bg-white/95 px-4 py-3 rounded-xl shadow-md border border-gray-200 text-center">
                        <span className="block text-gray-600 font-semibold text-sm">
                          Data Sumber Belum Tersedia
                        </span>
                        <span className="block text-gray-400 text-xs mt-1">
                          ({sourceLayerName.split(":")[1]})
                        </span>
                      </div>
                    </div>
                  )}
                  <CustomJSONMap
                    scale={sourceScale}
                    layerName={sourceLayerName}
                    color={"blue"}
                    showLayer={showBefore && layerAvailability.source}
                    mapCenter={REGION_CONFIG[region].center}
                    onMapLoad={setLeftMap}
                    colorMode={colorMode}
                    hasMorphology={checkHasMorphology(sourceLayerName)}
                  />
                </div>
                <div
                  className={`h-full relative overflow-hidden border-l border-green-400 ${isDragging ? "pointer-events-none" : ""}`}
                  style={{ width: `${100 - splitPosition}%` }}
                >
                  {/* PENAMBAHAN POINTER-EVENTS-NONE UNTUK SOLUSI PANNING PETA */}
                  {!layerAvailability.target && !attrsLoading && (
                    <div className="absolute inset-0 z-[50] flex flex-col items-center justify-center bg-gray-100/60 backdrop-blur-[2px] pointer-events-none">
                      <div className="bg-white/95 px-4 py-3 rounded-xl shadow-md border border-gray-200 text-center">
                        <span className="block text-gray-600 font-semibold text-sm">
                          Hasil Generalisasi Belum Tersedia
                        </span>
                        <span className="block text-gray-400 text-xs mt-1">
                          ({targetLayerName.split(":")[1]})
                        </span>
                      </div>
                    </div>
                  )}
                  <CustomJSONMap
                    scale={targetScale}
                    layerName={targetLayerName}
                    color={"green"}
                    showLayer={showAfter && layerAvailability.target}
                    mapCenter={REGION_CONFIG[region].center}
                    onMapLoad={setRightMap}
                    colorMode={colorMode}
                    hasMorphology={checkHasMorphology(targetLayerName)}
                  />
                </div>
                <div
                  className="absolute top-0 bottom-0 w-2 bg-white/70 hover:bg-white z-20 cursor-ew-resize flex items-center justify-center shadow-[0_0_15px_rgba(0,0,0,0.3)] transition-colors"
                  style={{
                    left: `${splitPosition}%`,
                    transform: "translateX(-50%)",
                  }}
                  onMouseDown={() => setIsDragging(true)}
                >
                  <div className="bg-white text-gray-700 p-1.5 rounded-full border border-gray-300 pointer-events-none shadow-lg">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>
            {showBefore && layerAvailability.source && (
              <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur px-4 py-2 rounded-lg shadow-sm text-blue-900 z-10 pointer-events-none">
                <p className="text-sm font-bold">Sumber: {sourceScale}</p>
              </div>
            )}
            {showAfter && layerAvailability.target && (
              <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur px-4 py-2 rounded-lg shadow-sm text-green-900 z-10 pointer-events-none">
                <p className="text-sm font-bold">Target: {targetScale}</p>
              </div>
            )}
          </div>

          <div className="bg-white border-t h-64 flex flex-col">
            <div className="flex border-b">
              <button
                onClick={() => setActivePanel("metadata")}
                className={`px-6 py-3 font-medium flex items-center gap-2 ${activePanel === "metadata" ? "bg-blue-50 text-blue-700 border-b-2 border-blue-700" : "text-gray-600 hover:bg-gray-50"}`}
              >
                <Info className="w-4 h-4" /> Metadata Layer
              </button>
              <button
                onClick={() => setActivePanel("download")}
                className={`px-6 py-3 font-medium flex items-center gap-2 ${activePanel === "download" ? "bg-blue-50 text-blue-700 border-b-2 border-blue-700" : "text-gray-600 hover:bg-gray-50"}`}
              >
                <Download className="w-4 h-4" /> Unduhan
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {activePanel === "metadata" && (
                <div className="flex gap-6 h-full p-1">
                  <div className="flex-1 min-w-0 flex flex-col">
                    <h3 className="font-semibold text-blue-800 mb-2 pb-2 border-b border-blue-200 text-sm flex justify-between items-center">
                      <span>Atribut Layer Sumber — {sourceScale}</span>
                      <span className="text-xs font-normal bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                        Maks 500 baris
                      </span>
                    </h3>
                    <AttributeTable
                      rows={sourceAttrs}
                      loading={attrsLoading}
                      error={attrsError}
                      hiddenColumns={HIDDEN_COLUMNS}
                      accentClass="text-blue-700"
                    />
                  </div>
                  <div className="w-px bg-gray-200 self-stretch mx-2" />
                  <div className="flex-1 min-w-0 flex flex-col">
                    <h3 className="font-semibold text-green-800 mb-2 pb-2 border-b border-green-200 text-sm flex justify-between items-center">
                      <span>Atribut Layer Target — {targetScale}</span>
                      <span className="text-xs font-normal bg-green-100 text-green-700 px-2 py-0.5 rounded">
                        Maks 500 baris
                      </span>
                    </h3>
                    <AttributeTable
                      rows={targetAttrs}
                      loading={attrsLoading}
                      error={attrsError}
                      hiddenColumns={HIDDEN_COLUMNS}
                      accentClass="text-green-700"
                    />
                  </div>
                </div>
              )}

              {activePanel === "download" && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {/* KARTU 1: GUIDEBOOK */}
                  <div className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-all bg-white group flex flex-col">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="p-3 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                        <Download className="w-6 h-6 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 mb-1">
                          GuideBook
                        </h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          Dokumen panduan lengkap metodologi dan standar
                          generalisasi.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100">
                      <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        PDF • 2.5 MB
                      </span>
                      <a
                        href="/downloads/guidebook.pdf"
                        download
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors inline-block text-center"
                      >
                        Unduh
                      </a>
                    </div>
                  </div>

                  {/* KARTU 2: PLUGIN QGIS */}
                  <div className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-all bg-white group flex flex-col">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="p-3 bg-green-50 rounded-lg group-hover:bg-green-100 transition-colors">
                        <Settings className="w-6 h-6 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 mb-1">
                          Plugin QGIS
                        </h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          Plugin untuk QGIS (.zip) yang mendukung proses
                          generalisasi.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100">
                      <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        ZIP • 450 KB
                      </span>
                      <a
                        href="/downloads/plugin_qgis.zip"
                        download
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors inline-block text-center"
                      >
                        Unduh
                      </a>
                    </div>
                  </div>

                  {/* KARTU 3: DATASET CAPSTONE (GEOPACKAGE DINAMIS) */}
                  <div className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-all bg-white group flex flex-col">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="p-3 bg-purple-50 rounded-lg group-hover:bg-purple-100 transition-colors">
                        <Layers className="w-6 h-6 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 mb-1">
                          Dataset Capstone
                        </h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          Unduh parsial atau keseluruhan dataset dalam berkas
                          GeoPackage.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 mt-auto">
                      <div className="flex gap-2">
                        <a
                          href={
                            layerAvailability.source
                              ? `https://helped-prague-synthesis-ryan.trycloudflare.com/geoserver/dashboard/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=${sourceLayerName}&outputFormat=geopackage&format_options=filename:${sourceZipName}`
                              : "#"
                          }
                          onClick={(e) => {
                            if (!layerAvailability.source) {
                              e.preventDefault();
                              setAlertModal({
                                isOpen: true,
                                title: "Data Belum Tersedia",
                                message: `Maaf, berkas untuk ${REGION_CONFIG[region]?.label || region} skala sumber ${sourceScale} belum diunggah ke server.`,
                              });
                            }
                          }}
                          className={`flex-1 py-2 text-white rounded-lg text-xs font-medium transition-colors text-center shadow-sm ${layerAvailability.source ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-400 cursor-not-allowed"}`}
                        >
                          Sumber: {sourceScale}
                        </a>
                        <a
                          href={
                            layerAvailability.target
                              ? `https://helped-prague-synthesis-ryan.trycloudflare.com/geoserver/dashboard/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=${targetLayerName}&outputFormat=geopackage&format_options=filename:${targetZipName}`
                              : "#"
                          }
                          onClick={(e) => {
                            if (!layerAvailability.target) {
                              e.preventDefault();
                              setAlertModal({
                                isOpen: true,
                                title: "Data Belum Tersedia",
                                message: `Maaf, berkas hasil generalisasi untuk ${REGION_CONFIG[region]?.label || region} skala target ${targetScale} belum tersedia di server.`,
                              });
                            }
                          }}
                          className={`flex-1 py-2 text-white rounded-lg text-xs font-medium transition-colors text-center shadow-sm ${layerAvailability.target ? "bg-green-600 hover:bg-green-700" : "bg-green-400 cursor-not-allowed"}`}
                        >
                          Target: {targetScale}
                        </a>
                      </div>
                      <div className="relative py-2 flex items-center">
                        <div className="flex-grow border-t border-gray-200"></div>
                        <span className="flex-shrink-0 mx-2 text-gray-400 text-xs">
                          atau
                        </span>
                        <div className="flex-grow border-t border-gray-200"></div>
                      </div>
                      <button
                        onClick={handleDynamicDownloadAll}
                        disabled={isDownloadingAll}
                        className={`w-full py-2 text-white rounded-lg text-sm font-medium transition-colors text-center shadow-sm flex items-center justify-center gap-2 outline-none ${isDownloadingAll ? "bg-purple-400 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700"}`}
                      >
                        {isDownloadingAll ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />{" "}
                            Memeriksa Data...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4" /> Unduh Seluruh
                            Dataset (.gpkg)
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* KARTU 4: DATA TRAINING SEGMENTASI MORFOLOGI */}
                  <div className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-all bg-white group flex flex-col">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="p-3 bg-amber-50 rounded-lg group-hover:bg-amber-100 transition-colors">
                        <Brain className="w-6 h-6 text-amber-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 mb-1">
                          Data Training AI
                        </h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          Dataset sampel ekstraksi morfologi pantai untuk
                          klasifikasi cerdas.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 mt-auto">
                      <a
                        href="/downloads/Data_Training_GAO.zip"
                        download="Data_Training_GAO.zip"
                        className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium transition-colors text-center shadow-sm block"
                      >
                        Unduh Data Training GAO (.zip)
                      </a>
                      <a
                        href="/downloads/Data_Training_Togean_Bitung.zip"
                        download="Data_Training_Togean_Bitung.zip"
                        className="w-full py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-medium transition-colors text-center shadow-sm block"
                      >
                        Unduh Data Togean & Bitung (.zip)
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default CoastlineDashboard;
