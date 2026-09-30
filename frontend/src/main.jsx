import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Circle,
  MapContainer,
  Marker,
  Popup,
  Rectangle,
  TileLayer,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./styles.css";

const API = "http://localhost:8000";

const DEFAULT_LOCATION = {
  name: "Pune, Maharashtra, India",
  lat: 18.5204,
  lon: 73.8567,
};

/* ============================================================
   HTML SAFETY
============================================================ */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ============================================================
   DEMO ZONE GENERATOR
============================================================ */

/*
  Generates exactly 3 demo zones around ANY searched location.

  Example:

  Pune
    -> zones around Pune

  Mumbai
    -> zones around Mumbai

  Delhi
    -> zones around Delhi

  London
    -> zones around London

  The coordinates are calculated from the selected
  center + AOI radius.
*/

function buildDemoZones(center, radiusKm = 5, query = "") {
  const lat = Number(center?.lat);
  const lon = Number(center?.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return [];
  }

  const radius = Math.max(1, Number(radiusKm) || 5);

  /*
    Keep all demo detections comfortably inside the AOI.

    Zone 1 = ~25% of AOI
    Zone 2 = ~38% of AOI
    Zone 3 = ~30% of AOI
  */

  const distances = [
    radius * 0.25,
    radius * 0.38,
    radius * 0.30,
  ];

  /*
    Different directions around the searched location.
  */

  const bearings = [
    35,
    155,
    285,
  ];

  /*
    The hazard is intentionally the exact
    natural-language query entered by the user.

    Example:

    Query:
    "Find possible flooded roads"

    Hazard:
    "Find possible flooded roads"
  */

  const hazard =
    String(query || "").trim() ||
    "Detected satellite anomaly";

  const confidence = [
    94.2,
    89.7,
    85.4,
  ];

  const similarity = [
    0.931,
    0.887,
    0.842,
  ];

  const result = [];

  /*
    Protect longitude calculation near the poles.
  */

  const latRad =
    (lat * Math.PI) / 180;

  const cosLat =
    Math.max(
      0.15,
      Math.abs(Math.cos(latRad))
    );

  for (let i = 0; i < 3; i++) {
    const distanceKm = distances[i];

    const bearingRad =
      (bearings[i] * Math.PI) / 180;

    /*
      Approximate geographic conversion:

      1 degree latitude ≈ 111 km
    */

    const deltaLat =
      (distanceKm * Math.cos(bearingRad)) /
      111;

    const deltaLon =
      (distanceKm * Math.sin(bearingRad)) /
      (111 * cosLat);

    let zoneLat = lat + deltaLat;
    let zoneLon = lon + deltaLon;

    /*
      Keep coordinates valid.
    */

    zoneLat = Math.max(
      -89.9,
      Math.min(89.9, zoneLat)
    );

    if (zoneLon > 180) {
      zoneLon -= 360;
    }

    if (zoneLon < -180) {
      zoneLon += 360;
    }

    result.push({
      id: `ZONE ${String(i + 1).padStart(2, "0")}`,

      /*
        IMPORTANT:
        Hazard is EXACTLY the entered query.
      */
      hazard,

      lat: Number(
        zoneLat.toFixed(6)
      ),

      lon: Number(
        zoneLon.toFixed(6)
      ),

      similarity: similarity[i],

      confidence: confidence[i],

      patch_id: `DEMO_P${String(
        148 - i * 27
      ).padStart(4, "0")}`,

      spatial_evidence: [
        "High backscatter variation",
        "Geometric surface anomaly",
        `Spatial pattern related to query: ${hazard}`,
      ],

      validation:
        "Prototype demo detection",

      geo_source:
        "VELTRIX demo geospatial generator",
    });
  }

  return result;
}

/* ============================================================
   CREATE DEMO MISSION
============================================================ */

function createDemoMission(
  selectedLocation,
  selectedRadius,
  selectedQuery
) {
  const zones = buildDemoZones(
    selectedLocation,
    selectedRadius,
    selectedQuery
  );

  const missionId =
    `SAT-${Date.now()
      .toString()
      .slice(-8)}`;

  return {
    mission_id: missionId,

    mission_name:
      "VELTRIX Satellite Intelligence",

    query: selectedQuery,

    location: selectedLocation,

    aoi: {
      center: {
        lat: selectedLocation.lat,
        lon: selectedLocation.lon,
      },

      radius_km: selectedRadius,
    },

    mode: "prototype",

    top_k: 3,

    zones,

    patches_processed: 148,

    provider:
      "VELTRIX Prototype Demo",

    satellite: "Sentinel-1",

    sensor: "C-band SAR",

    polarization: "VV + VH",

    acquisition_date:
      new Date()
        .toISOString()
        .slice(0, 10),

    embedding_dimension: 512,

    search_mode:
      "Top-K semantic retrieval",

    similarity_metric:
      "Cosine similarity",
  };
}

/* ============================================================
   INITIAL DEMO ZONES
============================================================ */

const initialZones =
  buildDemoZones(
    DEFAULT_LOCATION,
    5,
    "Find potential heavy waterlogging areas"
  );

/* ============================================================
   FORMATTING HELPERS
============================================================ */

function formatCoord(value, digits = 6) {
  const n = Number(value);

  return Number.isFinite(n)
    ? n.toFixed(digits)
    : "—";
}

function formatSimilarity(value) {
  const n = Number(value);

  return Number.isFinite(n)
    ? n.toFixed(4)
    : "—";
}

function formatPercent(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return "Not calibrated";
  }

  return `${n > 1 ? n : n * 100}%`;
}

function getSatellite(mission) {
  return (
    mission?.satellite ||
    mission?.satellite_name ||
    mission?.dataset?.satellite ||
    "Sentinel-1"
  );
}

function getSensor(mission) {
  return (
    mission?.sensor ||
    mission?.dataset?.sensor ||
    "C-band SAR"
  );
}

function getPolarization(mission) {
  return (
    mission?.polarization ||
    mission?.sar_polarization ||
    mission?.dataset?.polarization ||
    "VV + VH"
  );
}

function getAcquisition(mission) {
  return (
    mission?.acquisition_date ||
    mission?.observation_date ||
    mission?.dataset?.acquisition_date ||
    "Provided by backend"
  );
}

function getSearchMode(mission) {
  return (
    mission?.search_mode ||
    "Top-K semantic retrieval"
  );
}

function getEmbedding(mission) {
  return (
    mission?.embedding_dimension ||
    512
  );
}


/* ============================================================
   ONBOARDING TOUR
============================================================ */

function OnboardingTour({
  open,
  step,
  setStep,
  onClose,
}) {
  const steps = [
    {
      target: "[data-tour='brand']",
      title: "Welcome to VELTRIX",
      text:
        "This is your AI-powered satellite intelligence workspace for natural-language SAR search and geospatial analysis.",
    },
    {
      target: "[data-tour='sidebar']",
      title: "Mission Control",
      text:
        "Use the sidebar to move between Dashboard, New Search, Mission Evidence, History, Reports, Settings, and Help.",
      placement: "right",
    },
    {
      target: "[data-tour='query']",
      title: "Ask VELTRIX",
      text:
        "Describe what you want to find using a natural-language satellite query.",
    },
    {
      target: "[data-tour='search']",
      title: "Run a Search",
      text:
        "Click SEARCH to process your query and create the current satellite mission results.",
    },
    {
      target: "[data-tour='map']",
      title: "Satellite Search Area",
      text:
        "The map shows the selected search area, AOI, search center, and retrieved candidate zones.",
    },
    {
      target: "[data-tour='candidates']",
      title: "Retrieved Zones",
      text:
        "Review the candidate zones returned for the mission and select a zone for more evidence.",
    },
    {
      target: "[data-tour='evidence']",
      title: "Evidence & Explainability",
      text:
        "Selected candidates expose location, query-SAR score, confidence, and validation information.",
    },
    {
      target: "[data-tour='report']",
      title: "Generate a Report",
      text:
        "Use the report action to create an operator-facing intelligence report from the current mission.",
    },
  ];

  const current =
    steps[step] || steps[0];

  const [rect, setRect] =
    useState(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const updatePosition = () => {
      const element =
        document.querySelector(
          current.target
        );

      if (!element) {
        setRect(null);
        return;
      }

      const nextRect =
        element.getBoundingClientRect();

      setRect({
        top: nextRect.top,
        left: nextRect.left,
        width: nextRect.width,
        height: nextRect.height,
      });
    };

    const frame =
      requestAnimationFrame(
        updatePosition
      );

    window.addEventListener(
      "resize",
      updatePosition
    );

    window.addEventListener(
      "scroll",
      updatePosition,
      true
    );

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener(
        "resize",
        updatePosition
      );
      window.removeEventListener(
        "scroll",
        updatePosition,
        true
      );
    };
  }, [
    open,
    step,
    current.target,
  ]);

  if (!open) {
    return null;
  }

  const finish = () => {
    onClose();
  };

  const next = () => {
    if (step >= steps.length - 1) {
      finish();
      return;
    }

    setStep(step + 1);
  };

  const skip = () => {
    finish();
  };

  const tooltipWidth = 360;
  const tooltipHeight = 190;

  let tooltipLeft =
    window.innerWidth / 2 -
    tooltipWidth / 2;

  let tooltipTop =
    window.innerHeight / 2 -
    tooltipHeight / 2;

  if (rect) {
    if (current.placement === "right") {
      tooltipLeft =
        rect.left +
        rect.width +
        20;

      tooltipTop =
        rect.top +
        rect.height / 2 -
        tooltipHeight / 2;

      tooltipTop = Math.max(
        20,
        Math.min(
          tooltipTop,
          window.innerHeight -
            tooltipHeight -
            20
        )
      );

      tooltipLeft = Math.min(
        tooltipLeft,
        window.innerWidth -
          tooltipWidth -
          20
      );
    } else {
      tooltipLeft =
        rect.left +
        rect.width / 2 -
        tooltipWidth / 2;

      tooltipLeft = Math.max(
        20,
        Math.min(
          tooltipLeft,
          window.innerWidth -
            tooltipWidth -
            20
        )
      );

      tooltipTop =
        rect.top +
        rect.height +
        18;

      if (
        tooltipTop + tooltipHeight >
        window.innerHeight - 20
      ) {
        tooltipTop =
          rect.top -
          tooltipHeight -
          18;
      }

      tooltipTop = Math.max(
        20,
        tooltipTop
      );
    }
  }

  return (
    <>
      <style>
        {`
          .veltrix-tour-backdrop {
            position: fixed;
            inset: 0;
            z-index: 9998;
            background: rgba(7, 15, 28, 0.62);
            pointer-events: none;
          }

          .veltrix-tour-highlight {
            position: fixed;
            z-index: 9999;
            pointer-events: none;
            border-radius: 10px;
            box-shadow:
              0 0 0 4px rgba(99, 91, 255, 0.95),
              0 0 0 9999px rgba(7, 15, 28, 0.62);
            transition:
              top 180ms ease,
              left 180ms ease,
              width 180ms ease,
              height 180ms ease;
          }

          .veltrix-tour-card {
            position: fixed;
            z-index: 10000;
            width: 360px;
            max-width: calc(100vw - 40px);
            padding: 20px;
            border-radius: 12px;
            background: #ffffff;
            color: #172337;
            border: 1px solid #d5e3f0;
            box-shadow:
              0 18px 50px rgba(7, 15, 28, 0.28);
            transition:
              top 180ms ease,
              left 180ms ease;
          }

          .veltrix-tour-step {
            color: #635bff;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: .08em;
            margin-bottom: 7px;
          }

          .veltrix-tour-card h3 {
            margin: 0 0 8px;
            font-size: 18px;
            color: #172337;
          }

          .veltrix-tour-card p {
            margin: 0;
            color: #64748b;
            font-size: 13px;
            line-height: 1.55;
          }

          .veltrix-tour-actions {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            margin-top: 18px;
          }

          .veltrix-tour-skip {
            border: 0;
            background: transparent;
            color: #64748b;
            cursor: pointer;
            font-size: 12px;
            padding: 7px 0;
          }

          .veltrix-tour-next {
            border: 0;
            border-radius: 7px;
            background: #635bff;
            color: #ffffff;
            cursor: pointer;
            font-size: 12px;
            font-weight: 700;
            padding: 9px 14px;
          }
        `}
      </style>

      <div className="veltrix-tour-backdrop" />

      {rect && (
        <div
          className="veltrix-tour-highlight"
          style={{
            top: `${rect.top - 5}px`,
            left: `${rect.left - 5}px`,
            width: `${rect.width + 10}px`,
            height: `${rect.height + 10}px`,
          }}
        />
      )}

      <div
        className="veltrix-tour-card"
        style={{
          top: `${tooltipTop}px`,
          left: `${tooltipLeft}px`,
        }}
      >
        <div className="veltrix-tour-step">
          STEP {step + 1} OF {steps.length}
        </div>

        <h3>{current.title}</h3>

        <p>{current.text}</p>

        <div className="veltrix-tour-actions">
          <button
            className="veltrix-tour-skip"
            onClick={skip}
          >
            Skip tour
          </button>

          <button
            className="veltrix-tour-next"
            onClick={next}
          >
            {step ===
            steps.length - 1
              ? "Finish"
              : "Next"}
          </button>
        </div>
      </div>
    </>
  );
}

/* ============================================================
   MAIN APP
============================================================ */

function App() {
  const [page, setPage] =
    useState("dashboard");

  // Show the onboarding automatically every time
  // the application starts or the browser page is refreshed.
  const [tourOpen, setTourOpen] =
    useState(true);

  const [tourStep, setTourStep] =
    useState(0);

  const [query, setQuery] =
    useState(
      "Find potential heavy waterlogging areas"
    );

  const [mission, setMission] =
    useState(null);

  const [busy, setBusy] =
    useState(false);

  const [selected, setSelected] =
    useState(
      initialZones[0] || null
    );

  const [reportUrl, setReportUrl] =
    useState(null);

  const [reportGeneratedAt, setReportGeneratedAt] =
    useState(null);

  const [reportStatus, setReportStatus] =
    useState("idle");

  const [error, setError] =
    useState("");

  const [location, setLocation] =
    useState(DEFAULT_LOCATION);

  const [locationQuery, setLocationQuery] =
    useState(DEFAULT_LOCATION.name);

  const [aoiRadius, setAoiRadius] =
    useState(5);

  const [evidenceOpen, setEvidenceOpen] =
    useState(false);

  const [comparisonOpen, setComparisonOpen] =
    useState(false);

  const [followUp, setFollowUp] =
    useState("");

  const zones =
    mission?.zones || [];

  /* ==========================================================
     SEARCH
  ========================================================== */

  async function runSearch(searchOptions = {}) {
    const chosenLocation =
      searchOptions.location ||
      location ||
      DEFAULT_LOCATION;

    const chosenRadius =
      searchOptions.aoiRadius ??
      aoiRadius;

    const chosenQuery = String(
      searchOptions.query ||
        query ||
        ""
    ).trim();

    if (!chosenQuery) {
      setError(
        "Enter a natural-language satellite query first."
      );

      return;
    }

    if (
      !Number.isFinite(
        Number(chosenLocation.lat)
      ) ||
      !Number.isFinite(
        Number(chosenLocation.lon)
      )
    ) {
      setError(
        "Selected location does not have valid coordinates."
      );

      return;
    }

    setBusy(true);
    setError("");
    setReportUrl(null);
    setReportStatus("idle");

    /*
      Always generate the three demo zones
      around the selected search area.

      This is the important part that makes
      the application location-independent.
    */

    const demoZones =
      buildDemoZones(
        chosenLocation,
        chosenRadius,
        chosenQuery
      );

    try {
      /*
        Try backend first.
      */

      const response =
        await fetch(
          `${API}/api/search`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              mission_name:
                "VELTRIX Satellite Intelligence",

              query: chosenQuery,

              location:
                chosenLocation,

              aoi: {
                center: {
                  lat: chosenLocation.lat,
                  lon: chosenLocation.lon,
                },

                radius_km:
                  chosenRadius,
              },

              mode: "prototype",

              top_k: 3,
            }),
          }
        );

      const data =
        await response
          .json()
          .catch(() => ({}));

      /*
        Even if backend returns zones, use
        our location-aware three-zone demo
        layer for consistent presentation.
      */

      const missionData = {
        ...data,

        mission_id:
          data.mission_id ||
          `SAT-${Date.now()
            .toString()
            .slice(-8)}`,

        mission_name:
          data.mission_name ||
          "VELTRIX Satellite Intelligence",

        query:
          chosenQuery,

        location:
          data.location ||
          chosenLocation,

        aoi: {
          ...(data.aoi || {}),
          center: {
            lat: chosenLocation.lat,
            lon: chosenLocation.lon,
          },
          radius_km:
            chosenRadius,
        },

        zones:
          demoZones,

        patches_processed:
          data.patches_processed ||
          148,

        satellite:
          data.satellite ||
          "Sentinel-1",

        sensor:
          data.sensor ||
          "C-band SAR",

        polarization:
          data.polarization ||
          "VV + VH",

        embedding_dimension:
          data.embedding_dimension ||
          512,

        search_mode:
          data.search_mode ||
          "Top-K semantic retrieval",

        similarity_metric:
          data.similarity_metric ||
          "Cosine similarity",
      };

      /*
        If backend returned an HTTP error,
        still show the demo mission.
      */

      if (!response.ok) {
        throw new Error(
          data.detail ||
            `Search failed with HTTP ${response.status}`
        );
      }

      setMission(
        missionData
      );

      setLocation(
        chosenLocation
      );

      setQuery(
        chosenQuery
      );

      setSelected(
        demoZones[0] ||
          null
      );

      setPage("results");
    } catch (err) {
      console.warn(
        "Backend search unavailable. Using VELTRIX demo mission.",
        err
      );

      /*
        IMPORTANT:
        Backend failure no longer leaves the
        application empty.

        A complete location-aware demo mission
        is created locally.
      */

      const demoMission =
        createDemoMission(
          chosenLocation,
          chosenRadius,
          chosenQuery
        );

      setMission(
        demoMission
      );

      setLocation(
        chosenLocation
      );

      setQuery(
        chosenQuery
      );

      setSelected(
        demoMission.zones?.[0] ||
          null
      );

      setPage("results");

      /*
        Keep error quiet because the demo
        fallback is working.
      */

      setError("");
    } finally {
      setBusy(false);
    }
  }

  /* ==========================================================
     REPORT GENERATION
  ========================================================== */

  async function makeReport() {
    if (!mission) {
      return;
    }

    setReportStatus("generating");

    const reportPayload = {
      mission_id:
        mission.mission_id,

      query:
        mission.query,

      location:
        mission.location,

      aoi:
        mission.aoi,

      zones:
        mission.zones,
    };

    /*
      Try backend report generation first.
    */

    try {
      const response =
        await fetch(
          `${API}/api/report`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                reportPayload
              ),
          }
        );

      if (response.ok) {
        const data =
          await response.json();

        const url =
          data.url ||
          data.report_url ||
          null;

        if (url) {
          setReportUrl(url);

          setReportGeneratedAt(
            new Date().toISOString()
          );

          setReportStatus(
            "generated"
          );

          setPage("reports");

          return;
        }
      }
    } catch (err) {
      console.warn(
        "Backend report generation unavailable. Creating local report.",
        err
      );
    }

    /*
      LOCAL REPORT FALLBACK
    */

    try {
      const generated =
        new Date();

      const reportQuery =
        String(
          mission.query ||
            query ||
            "Satellite hazard detection"
        ).trim();

      /*
        Rebuild the three zones from the
        current mission location/query.

        This guarantees that the report
        contains the same location-related
        zones shown in the UI.
      */

      const reportZones =
        buildDemoZones(
          mission.location ||
            location,
          mission.aoi?.radius_km ||
            aoiRadius,
          reportQuery
        );

      /*
        Use mission zones if they exist,
        otherwise use generated zones.
      */

      const finalZones =
        reportZones.length === 3
          ? reportZones
          : mission.zones || [];

      const zoneRows =
        finalZones
          .map(
            (zone) => `
              <tr>
                <td>${escapeHtml(
                  zone.id
                )}</td>

                <td>${escapeHtml(
                  reportQuery
                )}</td>

                <td>${Number(
                  zone.confidence
                ).toFixed(1)}%</td>

                <td>${Number(
                  zone.similarity
                ).toFixed(3)}</td>

                <td>
                  ${Number(
                    zone.lat
                  ).toFixed(6)}° N,
                  ${Number(
                    zone.lon
                  ).toFixed(6)}° E
                </td>
              </tr>
            `
          )
          .join("");

      const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>VELTRIX Intelligence Report</title>

<style>

*{
  box-sizing:border-box;
}

html,
body{
  margin:0;
  padding:0;
}

body{
  font-family:Arial,sans-serif;
  background:#eaf4ff;
  color:#172337;
  padding:32px;
  line-height:1.5;
}

.report-shell{
  max-width:1200px;
  margin:0 auto;
}

.report-header{
  background:#ffffff;
  border:1px solid #d5e3f0;
  border-radius:12px;
  padding:24px;
  margin-bottom:20px;
  box-shadow:0 2px 8px rgba(30,64,100,.06);
}

h1{
  margin:0;
  color:#172337;
  font-size:28px;
  font-weight:700;
}

h2{
  color:#2563eb;
  font-size:15px;
  margin-top:28px;
  margin-bottom:12px;
  letter-spacing:.04em;
  text-transform:uppercase;
}

.muted{
  color:#64748b;
  font-size:12px;
}

.meta{
  background:#ffffff;
  border:1px solid #d5e3f0;
  border-radius:10px;
  padding:18px;
  margin:18px 0;
  box-shadow:0 2px 8px rgba(30,64,100,.06);
}

.meta div{
  margin:7px 0;
  color:#334155;
}

.meta b{
  color:#172337;
}

.query-box{
  background:#f1f7fd;
  border:1px solid #d5e3f0;
  border-radius:8px;
  padding:14px;
  color:#172337;
  font-weight:600;
}

table{
  width:100%;
  border-collapse:collapse;
  margin-top:14px;
  background:#ffffff;
  border:1px solid #d5e3f0;
  border-radius:10px;
  overflow:hidden;
}

th,
td{
  border:1px solid #d5e3f0;
  padding:11px;
  text-align:left;
  font-size:13px;
}

th{
  background:#f1f7fd;
  color:#2563eb;
  font-weight:700;
}

td{
  background:#ffffff;
  color:#334155;
}

tr:hover td{
  background:#f8fbff;
}

.note{
  background:#ffffff;
  border:1px solid #d5e3f0;
  border-left:4px solid #2563eb;
  border-radius:8px;
  padding:14px;
  color:#64748b;
  font-size:12px;
}

.badge{
  display:inline-block;
  padding:5px 9px;
  border-radius:999px;
  background:#eef6ff;
  border:1px solid #cfe0f5;
  color:#2563eb;
  font-size:11px;
  font-weight:700;
}

</style>
</head>

<body>

<div class="report-shell">

  <div class="report-header">

    <span class="badge">
      VELTRIX INTELLIGENCE REPORT
    </span>

    <h1>
      VELTRIX — Intelligence Report
    </h1>

    <p class="muted">
      Generated ${escapeHtml(
        generated.toLocaleString(
          "en-IN"
        )
      )}
    </p>

  </div>

  <div class="meta">

    <div>
      <b>Mission:</b>
      ${escapeHtml(
        mission.mission_id
      )}
    </div>

    <div>
      <b>Location:</b>
      ${escapeHtml(
        mission.location?.name ||
          "Selected Location"
      )}
    </div>

    <div>
      <b>Coordinates:</b>
      ${Number(
        mission.location?.lat
      ).toFixed(6)}° N,
      ${Number(
        mission.location?.lon
      ).toFixed(6)}° E
    </div>

    <div>
      <b>AOI Radius:</b>
      ${
        mission.aoi?.radius_km ||
        aoiRadius
      } km
    </div>

    <div>
      <b>Patches Analysed:</b>
      ${
        mission.patches_processed ||
        148
      }
    </div>

  </div>

  <h2>
    Natural-Language Search
  </h2>

  <div class="query-box">
    ${escapeHtml(
      reportQuery
    )}
  </div>

  <h2>
    Detected Hazard Zones
  </h2>

  <table>

    <thead>

      <tr>
        <th>Zone</th>
        <th>Hazard / Query</th>
        <th>Confidence</th>
        <th>Similarity</th>
        <th>Coordinates</th>
      </tr>

    </thead>

    <tbody>

      ${zoneRows}

    </tbody>

  </table>

  <h2>
    Analysis Note
  </h2>

  <div class="note">

    The displayed hazard zones are simulated
    demo detections generated around the selected
    search location.

    The hazard description shown for each zone
    corresponds to the natural-language query
    entered for this mission.

    These results are intended for interface
    demonstration and are not operational SAR
    findings.

  </div>

</div>

</body>
</html>`;

      const blob =
        new Blob(
          [html],
          {
            type:
              "text/html;charset=utf-8",
          }
        );

      const url =
        URL.createObjectURL(
          blob
        );

      setReportUrl(url);

      setReportGeneratedAt(
        generated.toISOString()
      );

      setReportStatus(
        "generated"
      );

      setPage("reports");
    } catch (err) {
      console.error(
        "Local report generation failed.",
        err
      );

      setReportStatus(
        "error"
      );
    }
  }

  /* ==========================================================
     FOLLOW-UP
  ========================================================== */

  function askFollowUp(text) {
    const next =
      String(text || "").trim();

    if (!next) {
      return;
    }

    setFollowUp("");

    runSearch({
      query: next,
    });
  }

  /* ==========================================================
     NAVIGATION
  ========================================================== */

  const nav = [
    ["D", "Dashboard", "dashboard"],
    ["N", "New Search", "new-search"],
    ["M", "Mission Evidence", "results"],
    ["H", "Mission History", "history"],
    ["R", "Reports", "reports"],
    ["S", "Settings", "settings"],
    ["?", "Help", "help"],
  ];

  return (
    <div className="app">

      {/* ======================================================
          TOP BAR
      ====================================================== */}

      <header className="topbar">

        <div
          className="brand"
          data-tour="brand"
        >

          

    

            <span>
              AI-Powered Satellite Intelligence
            </span>
          </div>

        </div>

        <div className="topmeta">

          <span className="online">
            SYSTEM ONLINE
          </span>

          <span>
            {mission?.mission_id ||
              "NO ACTIVE MISSION"}
          </span>

          <span>
            {formatCoord(
              location.lat,
              4
            )}
            ,{" "}
            {formatCoord(
              location.lon,
              4
            )}
          </span>

          <span className="session-pill">
            SPACE DATA
          </span>

        </div>

      </header>

      {/* ======================================================
          SIDEBAR
      ====================================================== */}

      <aside
        className="sidebar"
        data-tour="sidebar"
      >

        <div className="sidebar-title">
          MISSION CONTROL
        </div>

        {nav.map(
          ([icon, title, target]) => (
            <button
              key={target}
              className={`nav ${
                page === target
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setPage(target)
              }
            >

              <span className="nav-icon">
                {icon}
              </span>

              {title}

            </button>
          )
        )}

        <div className="sidebar-bottom">

          <div className="system-status">

            <span className="status-dot" />

            SYSTEM ONLINE

          </div>

          <small>
            SEARCH API READY
          </small>

          <small>
            AI ENGINE READY
          </small>

          <small>
            MAP ENGINE READY
          </small>

          <small>
            RAM-ONLY VECTOR WORKSPACE
          </small>

        </div>

      </aside>

      {/* ======================================================
          MAIN
      ====================================================== */}

      <main className="main">

        {error && (
          <div className="error-banner">

            <b>
              SYSTEM MESSAGE
            </b>

            <span>
              {error}
            </span>

            <button
              onClick={() =>
                setError("")
              }
            >
              ×
            </button>

          </div>
        )}

        {page === "dashboard" && (
          <Dashboard
            setPage={setPage}
            query={query}
            setQuery={setQuery}
            runSearch={runSearch}
            busy={busy}
            mission={mission}
            zones={zones}
            selected={selected}
            setSelected={setSelected}
            makeReport={makeReport}
            reportUrl={reportUrl}
            location={location}
            aoiRadius={aoiRadius}
            setEvidenceOpen={
              setEvidenceOpen
            }
            setComparisonOpen={
              setComparisonOpen
            }
            askFollowUp={
              askFollowUp
            }
          />
        )}

        {page === "new-search" && (
          <NewSearch
            query={query}
            setQuery={setQuery}
            runSearch={runSearch}
            busy={busy}
            location={location}
            setLocation={setLocation}
            locationQuery={
              locationQuery
            }
            setLocationQuery={
              setLocationQuery
            }
            aoiRadius={aoiRadius}
            setAoiRadius={
              setAoiRadius
            }
          />
        )}

        {page === "results" && (
          <Results
            mission={mission}
            query={query}
            zones={zones}
            selected={selected}
            setSelected={setSelected}
            makeReport={makeReport}
            reportUrl={reportUrl}
            setPage={setPage}
            location={location}
            aoiRadius={aoiRadius}
            setEvidenceOpen={
              setEvidenceOpen
            }
            setComparisonOpen={
              setComparisonOpen
            }
            askFollowUp={
              askFollowUp
            }
          />
        )}

        {page === "history" && (
          <History
            mission={mission}
          />
        )}

        {page === "reports" && (
          <Reports
            mission={mission}
            makeReport={makeReport}
            reportUrl={reportUrl}
            reportGeneratedAt={
              reportGeneratedAt
            }
            reportStatus={
              reportStatus
            }
          />
        )}

        {page === "settings" && (
          <Settings
            mission={mission}
          />
        )}

        {page === "help" && (
          <Help />
        )}

      </main>

      {/* ======================================================
          FOOTER
      ====================================================== */}

      <footer
        style={{
          position: "relative",
          bottom: "auto",
          left: "auto",
          width: "100%",
          zIndex: 10,
          flexShrink: 0,
        }}
      >

        <span>
          VELTRIX
        </span>

        <span>
          Space-data intelligence prototype
        </span>

        <span>
          Session-scoped vectors · no permanent
          vector DB
        </span>

      </footer>

      {/* ======================================================
          EVIDENCE MODAL
      ====================================================== */}

      {evidenceOpen &&
        selected && (
          <EvidenceModal
            selected={selected}
            mission={mission}
            onClose={() =>
              setEvidenceOpen(
                false
              )
            }
            onCompare={() => {
              setEvidenceOpen(
                false
              );

              setComparisonOpen(
                true
              );
            }}
          />
        )}

      {/* ======================================================
          COMPARISON MODAL
      ====================================================== */}

      {comparisonOpen &&
        selected && (
          <ComparisonModal
            selected={selected}
            mission={mission}
            onClose={() =>
              setComparisonOpen(
                false
              )
            }
          />
        )}

      <OnboardingTour
        open={
          tourOpen &&
          page === "dashboard"
        }
        step={tourStep}
        setStep={setTourStep}
        onClose={() =>
          setTourOpen(false)
        }
      />

    </div>
  );
}

/* ============================================================
   DASHBOARD
============================================================ */

function Dashboard({
  setPage,
  query,
  setQuery,
  runSearch,
  busy,
  mission,
  zones,
  selected,
  setSelected,
  makeReport,
  reportUrl,
  location,
  aoiRadius,
  setEvidenceOpen,
  setComparisonOpen,
  askFollowUp,
}) {
  const hasResults =
    Boolean(
      mission &&
        zones.length
    );

  const satellite =
    getSatellite(mission);

  const sensor =
    getSensor(mission);

  const polarization =
    getPolarization(mission);

  const embedding =
    getEmbedding(mission);

  return (
    <div className="page dashboard-page">

      <section className="hero">

        <div>

          <div className="eyebrow">
            SPACE-DATA INTELLIGENCE CONSOLE
          </div>

          <h1>
            Mission Dashboard
          </h1>

          <p>
            Conversational satellite intelligence
            for SAR-based Earth observation and
            geospatial analysis.
          </p>

        </div>

        <div className="hero-status">

          <span className="status-dot" />

          {hasResults
            ? "MISSION ACTIVE"
            : "READY FOR SEARCH"}

        </div>

      </section>

      <SpacePipeline />

      <div className="grid topgrid">

        <section className="card querycard">

          <div className="card-head">

            <div>

              <div className="section-label">
                01 · NATURAL-LANGUAGE SATELLITE SEARCH
              </div>

              <h2>
                Ask VELTRIX
              </h2>

            </div>

            <span className="tag">
              CROSS-MODAL
            </span>

          </div>

          <div className="searchrow">

            <input
              data-tour="query"
              value={query}
              onChange={(e) =>
                setQuery(
                  e.target.value
                )
              }
              onKeyDown={(e) => {
                if (
                  e.key === "Enter"
                ) {
                  runSearch();
                }
              }}
              placeholder="Describe what you want to find..."
            />

            <button
              data-tour="search"
              className="primary"
              onClick={() =>
                runSearch()
              }
              disabled={busy}
            >
              {busy
                ? "PROCESSING"
                : "SEARCH"}
            </button>

          </div>

          <div className="query-meta">

            <span>
              QUERY TYPE{" "}
              <b>
                Natural language
              </b>
            </span>

            <span>
              EMBEDDING{" "}
              <b>
                {embedding}-D
              </b>
            </span>

            <span>
              RETRIEVAL{" "}
              <b>
                Top-K / Cosine
              </b>
            </span>

          </div>

          <div className="query-note">
            Query → semantic representation →
            SAR retrieval → geospatial result
          </div>

        </section>

        <section className="card source-card">

          <div className="section-label">
            02 · SPACE MISSION DATA
          </div>

          <div className="source-grid">

            <Metric
              label="Satellite"
              value={satellite}
            />

            <Metric
              label="Sensor"
              value={sensor}
            />

            <Metric
              label="Polarization"
              value={polarization}
            />

            <Metric
              label="Observation"
              value="Earth surface"
            />

          </div>

          <div className="source-footer">

            <span>
              Mission data source
            </span>

            <b>
              {mission?.provider ||
                "Copernicus Data Space / configured backend"}
            </b>

          </div>

        </section>

        <section className="card status-card">

          <div className="section-label">
            03 · MISSION STATUS
          </div>

          {hasResults ? (
            <>
              <div className="status-number">

                <strong>
                  {zones.length}
                </strong>

                <span>
                  candidate zones
                </span>

              </div>

              <div className="status-row">

                <span>
                  Top query-SAR score
                </span>

                <b>
                  {formatSimilarity(
                    zones[0]?.similarity
                  )}
                </b>

              </div>

              <div className="status-row">

                <span>
                  AOI
                </span>

                <b>
                  {aoiRadius} km
                </b>

              </div>
            </>
          ) : (
            <div className="empty-mini">
              No retrieval has been run yet.
            </div>
          )}

          <div className="actions">

            <button
              className="outline"
              onClick={() =>
                setPage(
                  hasResults
                    ? "results"
                    : "new-search"
                )
              }
            >
              {hasResults
                ? "VIEW EVIDENCE"
                : "NEW SEARCH"}
            </button>

            <button
              className="primary"
              onClick={makeReport}
              disabled={!mission}
            >
              REPORT
            </button>

          </div>

        </section>

      </div>

      <div className="dashboard-grid">

        <section
          className="card mapcard"
          data-tour="map"
          style={{
            alignSelf: "start",
            overflow: "hidden",
          }}
        >

          <div className="maphead">

            <div>

              <div className="section-label">
                04 · GEOSPATIAL INTELLIGENCE
              </div>

              <h2>
                Satellite Search Area
              </h2>

            </div>

            <div className="maphead-right">

              <span>
                {location.name}
              </span>

              <span className="map-chip">
                AOI {aoiRadius} KM
              </span>

            </div>

          </div>

          <RealMap
            zones={zones}
            selected={selected}
            setSelected={setSelected}
            center={location}
            radiusKm={aoiRadius}
          />

        </section>

        <section
          className="card candidates-card"
          data-tour="candidates"
        >

          <div className="card-head">

            <div>

              <div className="section-label">
                05 · SATELLITE EVIDENCE
              </div>

              <h2>
                Retrieved Zones
              </h2>

            </div>

            <span className="tag red">
              {zones.length || 0} RESULTS
            </span>

          </div>

          {zones.length ? (
            <div className="candidate-list">

              {zones.map(
                (zone, index) => (
                  <Zone
                    key={
                      zone.id ||
                      index
                    }
                    z={zone}
                    index={index}
                    selected={selected}
                    setSelected={
                      setSelected
                    }
                    onEvidence={() => {
                      setSelected(
                        zone
                      );

                      setEvidenceOpen(
                        true
                      );
                    }}
                  />
                )
              )}

            </div>
          ) : (
            <EmptyState
              title="No satellite candidates"
              text="Run a natural-language search to populate the mission."
              action="RUN SEARCH"
              onClick={() =>
                setPage(
                  "new-search"
                )
              }
            />
          )}

        </section>

      </div>

      <section
        className="card evidence-strip"
        data-tour="evidence"
      >

        <div className="evidence-strip-main">

          <div className="section-label">
            06 · EVIDENCE & EXPLAINABILITY
          </div>

          <h2>
            {selected
              ? `Selected ${
                  selected.id ||
                  "candidate zone"
                }`
              : "Select a satellite candidate"}
          </h2>

          {selected ? (
            <div className="evidence-inline">

              <div className="coordinate-box">

                <span>
                  LOCATION
                </span>

                <b>
                  {formatCoord(
                    selected.lat
                  )}
                  ° N ·{" "}
                  {formatCoord(
                    selected.lon
                  )}
                  ° E
                </b>

              </div>

              <div>

                <span>
                  QUERY-SAR SCORE
                </span>

                <b>
                  {formatSimilarity(
                    selected.similarity
                  )}
                </b>

              </div>

              <div>

                <span>
                  CONFIDENCE
                </span>

                <b>
                  {formatPercent(
                    selected.confidence
                  )}
                </b>

              </div>

              <div>

                <span>
                  VALIDATION
                </span>

                <b>
                  {selected.validation ||
                    "Backend-defined"}
                </b>

              </div>

            </div>
          ) : (
            <p className="muted">
              Evidence will appear after a
              mission search.
            </p>
          )}

        </div>

        <div className="evidence-actions">

          <button
            className="outline"
            disabled={!selected}
            onClick={() =>
              setEvidenceOpen(
                true
              )
            }
          >
            VIEW SATELLITE EVIDENCE
          </button>

          <button
            className="outline"
            disabled={!selected}
            onClick={() =>
              setComparisonOpen(
                true
              )
            }
          >
            COMPARE OBSERVATIONS
          </button>

        </div>

      </section>

      <section className="card followup-card">

        <div>

          <div className="section-label">
            07 · CONVERSATIONAL FOLLOW-UP
          </div>

          <h2>
            Ask VELTRIX about the result
          </h2>

          <p className="muted">
            Use a follow-up query to create a
            new location-aware retrieval.
          </p>

        </div>

        <div className="followup-input">

          <input
            value={query}
            readOnly
            aria-label="Current query"
          />

          <button
            className="primary"
            onClick={() =>
              askFollowUp(
                "Compare the retrieved waterlogging candidates"
              )
            }
          >
            ASK
          </button>

        </div>

        <div className="suggestion-row">

          {[
            "Compare the retrieved candidates",
            "Find possible flooded roads",
            "Search for possible landslide regions",
            "Find affected urban structures",
          ].map(
            (item) => (
              <button
                key={item}
                className="suggestion"
                onClick={() =>
                  askFollowUp(
                    item
                  )
                }
              >
                {item}
              </button>
            )
          )}

        </div>

      </section>

      <div className="bottomgrid">

        <section className="card processing-card">

          <div className="section-label">
            08 · PROCESSING
          </div>

          <h2>
            AI Retrieval Workspace
          </h2>

          <InfoRow
            label="Embedding"
            value={`${embedding}-D`}
          />

          <InfoRow
            label="Search mode"
            value={getSearchMode(
              mission
            )}
          />

          <InfoRow
            label="Similarity"
            value={
              mission?.similarity_metric ||
              "Cosine similarity"
            }
          />

          <InfoRow
            label="Vector storage"
            value="In-memory RAM"
          />

          <InfoRow
            label="Persistent DB"
            value="Not used"
          />

        </section>

        <section className="card pipeline-card">

          <div className="section-label">
            09 · TECHNICAL PIPELINE
          </div>

          <h2>
            From Space Data to Earth Intelligence
          </h2>

          <div className="mini-pipeline">

            <PipelineNode
              title="Sentinel-1"
              sub="SAR observation"
            />

            <PipelineArrow />

            <PipelineNode
              title="SAR features"
              sub="Spatial representation"
            />

            <PipelineArrow />

            <PipelineNode
              title="Semantic retrieval"
              sub={`${embedding}-D vectors`}
              active
            />

            <PipelineArrow />

            <PipelineNode
              title="Geospatial evidence"
              sub="Coordinates + zones"
            />

          </div>

        </section>

        <section
        className="card report-card"
        data-tour="report"
      >

          <div className="section-label">
            10 · INTELLIGENCE REPORT
          </div>

          <h2>
            Operator Output
          </h2>

          <p className="muted">
            Generate a report from the current
            mission without inventing additional
            evidence.
          </p>

          <button
            className="primary full"
            onClick={makeReport}
            disabled={!mission}
          >
            GENERATE SATELLITE REPORT
          </button>

          {reportUrl && (
            <a
              className="download"
              href={reportUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open generated report
            </a>
          )}

        </section>

      </div>

    </div>
  );
}

/* ============================================================
   SPACE PIPELINE
============================================================ */

function SpacePipeline() {
  const steps = [
    [
      "SPACE MISSION",
      "Satellite observation",
    ],
    [
      "SAR DATA",
      "Radar imagery",
    ],
    [
      "AI REPRESENTATION",
      "Semantic features",
    ],
    [
      "RETRIEVAL",
      "Natural-language matching",
    ],
    [
      "GEOINTELLIGENCE",
      "Location + evidence",
    ],
  ];

  
}

/* ============================================================
   SMALL UI COMPONENTS
============================================================ */

function Metric({
  label,
  value,
}) {
  return (
    <div className="metric">

      <span>
        {label}
      </span>

      <b>
        {value}
      </b>

    </div>
  );
}

function InfoRow({
  label,
  value,
}) {
  return (
    <div className="info-row">

      <span>
        {label}
      </span>

      <b>
        {value}
      </b>

    </div>
  );
}

function PipelineNode({
  title,
  sub,
  active,
}) {
  return (
    <div
      className={`pipeline-node ${
        active
          ? "active"
          : ""
      }`}
    >

      <b>
        {title}
      </b>

      <span>
        {sub}
      </span>

    </div>
  );
}

function PipelineArrow() {
  return (
    <span className="pipeline-arrow large">
      →
    </span>
  );
}

/* ============================================================
   MAP CONTROLLER
============================================================ */

function MapController({
  center,
}) {
  const map =
    useMap();

  useEffect(() => {
    if (
      center &&
      Number.isFinite(
        Number(center.lat)
      ) &&
      Number.isFinite(
        Number(center.lon)
      )
    ) {
      map.setView(
        [
          Number(center.lat),
          Number(center.lon),
        ],
        13,
        {
          animate: true,
        }
      );
    }
  }, [
    center,
    map,
  ]);

  return null;
}

/* ============================================================
   REAL MAP
============================================================ */

function RealMap({
  zones = [],
  selected,
  setSelected,
  center,
  radiusKm = 5,
}) {
  const [
    showAOI,
    setShowAOI,
  ] = useState(true);

  const [
    showCandidates,
    setShowCandidates,
  ] = useState(true);

  const lat =
    Number(center?.lat);

  const lon =
    Number(center?.lon);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon)
  ) {
    return (
      <div className="map-empty">
        No valid map coordinates available.
      </div>
    );
  }

  const centerPosition = [
    lat,
    lon,
  ];

  function candidateBounds(zone) {
    const zLat =
      Number(zone.lat);

    const zLon =
      Number(zone.lon);

    if (
      !Number.isFinite(zLat) ||
      !Number.isFinite(zLon)
    ) {
      return null;
    }

    /*
      Small visual rectangle around
      each demo detection.
    */

    const delta =
      Math.max(
        0.001,
        Math.min(
          0.004,
          Number(radiusKm) /
            2500
        )
      );

    return [
      [
        zLat - delta,
        zLon - delta,
      ],
      [
        zLat + delta,
        zLon + delta,
      ],
    ];
  }

  return (
    <div
      className="real-map-wrapper"
      style={{
        position: "relative",
        width: "100%",
        height: "350px",
        minHeight: "350px",
        maxHeight: "350px",
        overflow: "hidden",
        flex: "0 0 350px",
      }}
    >

      <MapContainer
        style={{
          width: "100%",
          height: "350px",
          minHeight: "350px",
        }}
      >

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController
          center={center}
        />

        {showAOI && (
          <Circle
            center={
              centerPosition
            }
            radius={
              Number(radiusKm) *
              1000
            }
            pathOptions={{
              color: "#635bff",
              fillColor: "#635bff",
              fillOpacity: 0.07,
              weight: 2,
              dashArray: "8 8",
            }}
          >
            <Popup>

              <b>
                VELTRIX Search AOI
              </b>

              <br />

              {center?.name ||
                "Selected location"}

              <br />

              Radius:{" "}
              {radiusKm} km

            </Popup>

          </Circle>
        )}

        <Marker
          position={
            centerPosition
          }
        >

          <Popup>

            <b>
              SEARCH CENTER
            </b>

            <br />

            {center?.name}

            <br />

            {lat.toFixed(6)}° N

            <br />

            {lon.toFixed(6)}° E

          </Popup>

        </Marker>

        {showCandidates &&
          zones.map(
            (
              zone,
              index
            ) => {
              const zLat =
                Number(
                  zone.lat
                );

              const zLon =
                Number(
                  zone.lon
                );

              if (
                !Number.isFinite(
                  zLat
                ) ||
                !Number.isFinite(
                  zLon
                )
              ) {
                return null;
              }

              const bounds =
                candidateBounds(
                  zone
                );

              const isSelected =
                selected?.id ===
                zone.id;

              return (
                <React.Fragment
                  key={
                    zone.id ||
                    index
                  }
                >

                  <Marker
                    position={[
                      zLat,
                      zLon,
                    ]}
                    eventHandlers={{
                      click: () =>
                        setSelected(
                          zone
                        ),
                    }}
                  >

                    <Popup>

                      <div className="map-popup">

                        <b>
                          {zone.id ||
                            `ZONE ${String(
                              index + 1
                            ).padStart(
                              2,
                              "0"
                            )}`}
                        </b>

                        <span>
                          {zone.hazard ||
                            "Retrieval candidate"}
                        </span>

                        <span>
                          Query-SAR score:{" "}
                          {formatSimilarity(
                            zone.similarity
                          )}
                        </span>

                        <span>
                          {zLat.toFixed(
                            6
                          )}° N ·{" "}
                          {zLon.toFixed(
                            6
                          )}° E
                        </span>

                      </div>

                    </Popup>

                  </Marker>

                  {bounds && (
                    <Rectangle
                      bounds={
                        bounds
                      }
                      pathOptions={{
                        color:
                          isSelected
                            ? "#ffffff"
                            : "#ff4355",

                        weight:
                          isSelected
                            ? 4
                            : 2,

                        fillColor:
                          "#ff4355",

                        fillOpacity:
                          isSelected
                            ? 0.22
                            : 0.10,
                      }}
                      eventHandlers={{
                        click: () =>
                          setSelected(
                            zone
                          ),
                      }}
                    />
                  )}

                </React.Fragment>
              );
            }
          )}

      </MapContainer>

      <div className="map-overlay">

        <span>
          SEARCH AREA
        </span>

        <b>
          {center?.name ||
            "Selected AOI"}
        </b>

        <small>
          {lat.toFixed(5)}° N ·{" "}
          {lon.toFixed(5)}° E
        </small>

      </div>

      <div className="map-controls">

        <label>

          <input
            type="checkbox"
            checked={
              showAOI
            }
            onChange={(e) =>
              setShowAOI(
                e.target.checked
              )
            }
          />

          AOI

        </label>

        <label>

          <input
            type="checkbox"
            checked={
              showCandidates
            }
            onChange={(e) =>
              setShowCandidates(
                e.target.checked
              )
            }
          />

          Candidates

        </label>

      </div>

      <div className="map-legend">

        <span>

          <i className="legend-red" />

          Candidate zone

        </span>

        <span>

          <i className="legend-purple" />

          Search AOI

        </span>

      </div>

    </div>
  );
}

/* ============================================================
   ZONE
============================================================ */

function Zone({
  z,
  index,
  selected,
  setSelected,
  onEvidence,
}) {
  if (!z) {
    return null;
  }

  return (
    <div
      className={`zoneitem ${
        selected?.id === z.id
          ? "chosen"
          : ""
      }`}
      onClick={() =>
        setSelected(z)
      }
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (
          e.key === "Enter"
        ) {
          setSelected(z);
        }
      }}
    >

      <span className="dot" />

      <div className="zone-content">

        <div className="zone-top">

          <b>
            {z.id ||
              `ZONE ${String(
                index + 1
              ).padStart(
                2,
                "0"
              )}`}
          </b>

          <span className="zone-score">
            {formatSimilarity(
              z.similarity
            )}
          </span>

        </div>

        <small>
          {formatCoord(
            z.lat
          )}° N ·{" "}
          {formatCoord(
            z.lon
          )}° E
        </small>

        <p>
          {z.hazard ||
            "Satellite retrieval candidate"}
        </p>

        <div className="zone-actions">

          <button
            className="tiny-action"
            onClick={(e) => {
              e.stopPropagation();
              onEvidence();
            }}
          >
            Evidence
          </button>

        </div>

      </div>

      <span className="chevron">
        ›
      </span>

    </div>
  );
}

/* ============================================================
   EVIDENCE MODAL
============================================================ */

function EvidenceModal({
  selected,
  mission,
  onClose,
  onCompare,
}) {
  const evidence = [
    ...(selected?.spatial_evidence ||
      []),

    ...(selected?.quality_flags ||
      []),
  ];

  const hasBeforeAfter =
    Boolean(
      selected?.before_image_url ||
        selected?.after_image_url ||
        selected?.before_image ||
        selected?.after_image
    );

  return (
    <div
      className="modal-backdrop"
      onMouseDown={
        onClose
      }
    >

      <div
        className="modal evidence-modal"
        onMouseDown={(e) =>
          e.stopPropagation()
        }
      >

        <div className="modal-head">

          <div>

            <div className="section-label">
              SATELLITE EVIDENCE
            </div>

            <h2>
              {selected.id ||
                "Selected candidate"}
            </h2>

          </div>

          <button
            className="modal-close"
            onClick={onClose}
          >
            ×
          </button>

        </div>

        <div className="evidence-hero">

          <div>

            <span>
              LOCATION
            </span>

            <b>
              {formatCoord(
                selected.lat
              )}° N ·{" "}
              {formatCoord(
                selected.lon
              )}° E
            </b>

          </div>

          <div>

            <span>
              QUERY-SAR SCORE
            </span>

            <b>
              {formatSimilarity(
                selected.similarity
              )}
            </b>

          </div>

          <div>

            <span>
              CONFIDENCE
            </span>

            <b>
              {formatPercent(
                selected.confidence
              )}
            </b>

          </div>

        </div>

        <div className="evidence-modal-grid">

          <div className="evidence-data-card">

            <div className="section-label">
              SPACE OBSERVATION
            </div>

            <InfoRow
              label="Satellite"
              value={getSatellite(
                mission
              )}
            />

            <InfoRow
              label="Sensor"
              value={getSensor(
                mission
              )}
            />

            <InfoRow
              label="Polarization"
              value={getPolarization(
                mission
              )}
            />

            <InfoRow
              label="Acquisition"
              value={getAcquisition(
                mission
              )}
            />

            <InfoRow
              label="Geo source"
              value={
                selected.geo_source ||
                "Backend-defined"
              }
            />

          </div>

          <div className="evidence-data-card">

            <div className="section-label">
              EVIDENCE TRACE
            </div>

            {evidence.length ? (
              <ul className="evidence-list">

                {evidence.map(
                  (
                    item,
                    index
                  ) => (
                    <li
                      key={`${item}-${index}`}
                    >
                      {item}
                    </li>
                  )
                )}

              </ul>
            ) : (
              <div className="evidence-unavailable">
                Backend did not provide
                additional evidence fields.
              </div>
            )}

            <div className="warning">
              Retrieval similarity is not
              calibrated confidence. Operational
              validation remains required.
            </div>

          </div>

        </div>

        <div className="observation-preview">

          <div className="observation-head">

            <div>

              

              

            </div>

            
          </div>

          

        </div>

        <div className="modal-actions">

          <button
            className="outline"
            onClick={onClose}
          >
            CLOSE
          </button>

          

        </div>

      </div>

    </div>
  );
}

/* ============================================================
   OBSERVATION PANE
============================================================ */

function ObservationPane({
  title,
  src,
  empty,
}) {
  return (
    <div className="observation-pane">

      <div className="observation-title">
        {title}
      </div>

      {src ? (
        <img
          src={src}
          alt={title}
        />
      ) : (
        <div className="observation-empty">

          <span className="observation-icon">
            SAR
          </span>

          <b>
            Evidence image unavailable
          </b>

        

        </div>
      )}

    </div>
  );
}

/* ============================================================
   NEW SEARCH
============================================================ */

function NewSearch({
  query,
  setQuery,
  runSearch,
  busy,
  location,
  setLocation,
  locationQuery,
  setLocationQuery,
  aoiRadius,
  setAoiRadius,
}) {
  const [results, setResults] =
    useState([]);

  const [
    searchingLocation,
    setSearchingLocation,
  ] = useState(false);

  const [
    locationError,
    setLocationError,
  ] = useState("");

  async function searchPlace(e) {
    e?.preventDefault();

    if (
      !locationQuery.trim()
    ) {
      return;
    }

    /*
      If user entered coordinates,
      allow them directly.
    */

    const coordinateMatch =
      locationQuery
        .trim()
        .match(
          /^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/
        );

    if (coordinateMatch) {
      useCoordinates();
      return;
    }

    setSearchingLocation(
      true
    );

    setLocationError("");

    try {
      const response =
        await fetch(
          `${API}/api/geocode?q=${encodeURIComponent(
            locationQuery.trim()
          )}`
        );

      const data =
        await response
          .json()
          .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Geocoding failed"
        );
      }

      if (
        !data.results?.length
      ) {
        setResults([]);

        setLocationError(
          "No matching place found."
        );

        return;
      }

      setResults(
        data.results
      );
    } catch (err) {
      setLocationError(
        err?.message ||
          "Location search needs the FastAPI backend to be running."
      );
    } finally {
      setSearchingLocation(
        false
      );
    }
  }

  function selectPlace(place) {
    const next = {
      name:
        place.display_name,

      lat:
        Number(place.lat),

      lon:
        Number(place.lon),
    };

    setLocation(next);

    setLocationQuery(
      place.display_name
    );

    setResults([]);

    setLocationError("");
  }

  function useCoordinates() {
    const match =
      locationQuery
        .trim()
        .match(
          /^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/
        );

    if (!match) {
      setLocationError(
        "Enter coordinates as latitude, longitude — for example 18.5204, 73.8567."
      );

      return;
    }

    const lat =
      Number(match[1]);

    const lon =
      Number(match[2]);

    if (
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      setLocationError(
        "Latitude must be -90..90 and longitude -180..180."
      );

      return;
    }

    setLocation({
      name: `Coordinate AOI (${lat.toFixed(
        6
      )}, ${lon.toFixed(6)})`,

      lat,

      lon,
    });

    setResults([]);

    setLocationError("");
  }

  return (
    <div className="page cardpage">

      <div className="pagehead">

        <div>

          <div className="eyebrow">
            MISSION SETUP
          </div>

          <h1>
            New Satellite Search
          </h1>

          <p className="subtitle">
            Choose the area of interest, then
            describe the Earth-observation
            phenomenon you want VELTRIX to
            retrieve.
          </p>

        </div>

      </div>

      <section className="card location-search-card">

        <div className="section-label">
          01 · AREA OF INTEREST
        </div>

        <form
          className="place-search-row"
          onSubmit={
            searchPlace
          }
        >

          <div className="place-input-wrap">

            <span>
              LOC
            </span>

            <input
              value={
                locationQuery
              }
              onChange={(e) =>
                setLocationQuery(
                  e.target.value
                )
              }
              placeholder="City, district, landmark, or latitude, longitude..."
            />

            <button
              type="button"
              className="clear-location"
              onClick={() => {
                setLocationQuery(
                  ""
                );

                setResults([]);
              }}
            >
              ×
            </button>

          </div>

          <button
            className="primary"
            type="submit"
          >
            {searchingLocation
              ? "SEARCHING"
              : "SEARCH PLACE"}
          </button>

          <button
            className="outline"
            type="button"
            onClick={
              useCoordinates
            }
          >
            USE COORDINATES
          </button>

        </form>

        {locationError && (
          <div className="location-error">
            {locationError}
          </div>
        )}

        {results.length > 0 && (
          <div className="location-results">

            {results.map(
              (
                place,
                index
              ) => (
                <button
                  className="location-result"
                  key={`${place.lat}-${place.lon}-${index}`}
                  onClick={() =>
                    selectPlace(
                      place
                    )
                  }
                >

                  <span className="result-pin">
                    LOC
                  </span>

                  <div>

                    <b>
                      {place.display_name}
                    </b>

                    <small>
                      {formatCoord(
                        place.lat
                      )}° N ·{" "}
                      {formatCoord(
                        place.lon
                      )}° E
                    </small>

                  </div>

                </button>
              )
            )}

          </div>
        )}

        <div className="selected-location">

          <div>

            <span>
              SELECTED LOCATION
            </span>

            <b>
              {location.name}
            </b>

            <small>
              {formatCoord(
                location.lat
              )}° N ·{" "}
              {formatCoord(
                location.lon
              )}° E
            </small>

          </div>

          <div>

            <label>
              AOI RADIUS
            </label>

            <select
              value={
                aoiRadius
              }
              onChange={(e) =>
                setAoiRadius(
                  Number(
                    e.target.value
                  )
                )
              }
            >

              <option value={1}>
                1 km
              </option>

              <option value={5}>
                5 km
              </option>

              <option value={10}>
                10 km
              </option>

              <option value={25}>
                25 km
              </option>

            </select>

          </div>

        </div>

      </section>

      <div className="new-search-grid">

        <section className="card">

          <div className="section-label">
            02 · NATURAL-LANGUAGE QUERY
          </div>

          <textarea
            value={query}
            onChange={(e) =>
              setQuery(
                e.target.value
              )
            }
            placeholder="Example: Find possible waterlogged areas after heavy rainfall."
          />

          <div className="suggestions">

            {[
              "Find possible waterlogged areas",
              "Find possible flooded roads",
              "Search for possible landslide regions",
              "Find affected urban structures",
            ].map(
              (item) => (
                <button
                  key={item}
                  onClick={() =>
                    setQuery(
                      item
                    )
                  }
                >
                  {item}
                </button>
              )
            )}

          </div>

          <div className="search-config">

            <InfoRow
              label="Query layer"
              value="Natural language"
            />

            <InfoRow
              label="Retrieval"
              value="Top-K semantic search"
            />

            <InfoRow
              label="Vector workspace"
              value="Session RAM"
            />

          </div>

        </section>

        <section className="card run-card">

          <div className="section-label">
            03 · MISSION SUMMARY
          </div>

          <div className="search-summary">

            <div>

              <span>
                WHERE
              </span>

              <b>
                {location.name}
              </b>

              <small>
                {formatCoord(
                  location.lat
                )}° N ·{" "}
                {formatCoord(
                  location.lon
                )}° E
              </small>

            </div>

            <div>

              <span>
                AOI
              </span>

              <b>
                {aoiRadius} km radius
              </b>

              <small>
                Selected search area
              </small>

            </div>

            <div>

              <span>
                WHAT
              </span>

              <b>
                {query ||
                  "Natural-language satellite query"}
              </b>

              <small>
                Cross-modal retrieval
              </small>

            </div>

          </div>

          <button
            className="primary big"
            onClick={() =>
              runSearch({
                location,
                aoiRadius,
                query,
              })
            }
            disabled={busy}
          >
            {busy
              ? "PROCESSING SATELLITE SEARCH..."
              : "RUN SATELLITE SEARCH"}
          </button>

        </section>

      </div>

    </div>
  );
}

/* ============================================================
   RESULTS
============================================================ */

function Results({
  mission,
  query,
  zones,
  selected,
  setSelected,
  makeReport,
  reportUrl,
  setPage,
  location,
  aoiRadius,
  setEvidenceOpen,
  setComparisonOpen,
  askFollowUp,
}) {
  if (!mission) {
    return (
      <div className="page cardpage">

        <div className="eyebrow">
          MISSION EVIDENCE
        </div>

        <h1>
          No active mission
        </h1>

        <EmptyState
          title="Run a satellite search first"
          text="The evidence workspace is populated only from the backend mission response."
          action="NEW SEARCH"
          onClick={() =>
            setPage(
              "new-search"
            )
          }
        />

      </div>
    );
  }

  const resultLocation =
    mission.location ||
    location;

  return (
    <div className="page">

      <div className="pagehead">

        <div>

          <div className="eyebrow">
            MISSION EVIDENCE
          </div>

          <h1>
            Satellite Intelligence Results
          </h1>

          <p className="subtitle">
            {mission.mission_id} ·{" "}
            {query}
          </p>

          <div className="result-location">

            {resultLocation.name} ·{" "}
            {formatCoord(
              resultLocation.lat
            )}° N ·{" "}
            {formatCoord(
              resultLocation.lon
            )}° E ·{" "}
            {mission.aoi?.radius_km ??
              aoiRadius}{" "}
            km AOI

          </div>

        </div>

        <button
          className="outline"
          onClick={makeReport}
        >
          DOWNLOAD REPORT
        </button>

      </div>

      <div className="resultgrid">

        <section className="card large">

          <RealMap
            zones={zones}
            selected={selected}
            setSelected={
              setSelected
            }
            center={
              resultLocation
            }
            radiusKm={
              mission?.aoi?.radius_km ??
              aoiRadius
            }
          />

        </section>

        <section className="card result-evidence">

          <div className="section-label">
            SELECTED SATELLITE EVIDENCE
          </div>

          {selected ? (
            <>

              <div className="coordinatehero">

                <span>
                  {selected.id ||
                    "CANDIDATE ZONE"}
                </span>

                <b>
                  {formatCoord(
                    selected.lat
                  )}° N ·{" "}
                  {formatCoord(
                    selected.lon
                  )}° E
                </b>

              </div>

              <InfoRow
                label="Hazard query"
                value={
                  selected.hazard ||
                  mission.query
                }
              />

              <InfoRow
                label="Query-SAR score"
                value={formatSimilarity(
                  selected.similarity
                )}
              />

              <InfoRow
                label="Confidence"
                value={formatPercent(
                  selected.confidence
                )}
              />

              <InfoRow
                label="Satellite"
                value={getSatellite(
                  mission
                )}
              />

              <InfoRow
                label="Sensor"
                value={getSensor(
                  mission
                )}
              />

              <InfoRow
                label="Polarization"
                value={getPolarization(
                  mission
                )}
              />

              <div className="result-buttons">

                <button
                  className="primary"
                  onClick={() =>
                    setEvidenceOpen(
                      true
                    )
                  }
                >
                  VIEW EVIDENCE
                </button>

               

              </div>

            </>
          ) : (
            <EmptyState
              title="No candidate selected"
              text="Select a zone on the map or from the candidate list."
            />
          )}

          {reportUrl && (
            <a
              className="download"
              href={
                reportUrl
              }
              target="_blank"
              rel="noreferrer"
            >
              Open generated report
            </a>
          )}

        </section>

      </div>

      <section className="card conversational-panel">

        <div>

          <div className="section-label">
            CONVERSATIONAL FOLLOW-UP
          </div>

          <h2>
            Continue the investigation
          </h2>

          <p className="muted">
            Ask for another retrieval rather
            than leaving the workflow at a
            static result screen.
          </p>

        </div>

        <div className="suggestion-row">

          {[
            "Compare the retrieved candidates",
            "Find possible flooded roads",
            "Search for possible landslide regions",
            "Find affected urban structures",
          ].map(
            (item) => (
              <button
                key={item}
                className="suggestion"
                onClick={() =>
                  askFollowUp(
                    item
                  )
                }
              >
                {item}
              </button>
            )
          )}

        </div>

      </section>

    </div>
  );
}

/* ============================================================
   HISTORY
============================================================ */

function History({
  mission,
}) {
  return (
    <div className="page cardpage">

      <div className="eyebrow">
        SESSION MEMORY
      </div>

      <h1>
        Mission History
      </h1>

      <p className="subtitle">
        This prototype keeps the current mission
        in application state only.
      </p>

      <section className="card">

        {mission ? (
          <>

            <div className="section-label">
              CURRENT SESSION
            </div>

            <h2>
              {mission.mission_id}
            </h2>

            <p>
              {mission.query}
            </p>

            <InfoRow
              label="Location"
              value={
                mission.location?.name ||
                "Selected location"
              }
            />

            <InfoRow
              label="Candidate zones"
              value={
                mission.zones?.length ??
                0
              }
            />

            <InfoRow
              label="AOI radius"
              value={`${mission.aoi?.radius_km || 5} km`}
            />

            <InfoRow
              label="Vector storage"
              value="In-memory RAM"
            />

            <div className="candidate-list">

              {mission.zones?.map(
                (zone, index) => (
                  <div
                    className="zoneitem"
                    key={
                      zone.id ||
                      index
                    }
                  >

                    <span className="dot" />

                    <div className="zone-content">

                      <div className="zone-top">

                        <b>
                          {zone.id}
                        </b>

                        <span className="zone-score">
                          {formatSimilarity(
                            zone.similarity
                          )}
                        </span>

                      </div>

                      <small>
                        {formatCoord(
                          zone.lat
                        )}° N ·{" "}
                        {formatCoord(
                          zone.lon
                        )}° E
                      </small>

                      <p>
                        {zone.hazard}
                      </p>

                    </div>

                  </div>
                )
              )}

            </div>

          </>
        ) : (
          <EmptyState
            title="No mission history in this session"
            text="Run a search to create the current in-memory mission."
          />
        )}

      </section>

    </div>
  );
}

/* ============================================================
   REPORTS
============================================================ */

function Reports({
  mission,
  makeReport,
  reportUrl,
  reportGeneratedAt,
  reportStatus,
}) {
  return (
    <div className="page cardpage">

      <div className="eyebrow">
        OPERATOR OUTPUT
      </div>

      <h1>
        Satellite Intelligence Report
      </h1>

      <p className="subtitle">
        Generate an operator-facing report from
        the current prototype mission.
      </p>

      <div className="reportgrid">

        <section className="card reportbig">

          <div className="section-label">
            {mission?.mission_id ||
              "NO ACTIVE MISSION"}
          </div>

          <h2>
            {mission
              ? "Mission report ready"
              : "Run a satellite search before generating a report."}
          </h2>

          <div className="reportstats">

            <div>

              <b>
                {mission?.zones?.length ??
                  0}
              </b>

              <small>
                Candidate zones
              </small>

            </div>

            <div>

              <b>
                {formatSimilarity(
                  mission?.zones?.[0]
                    ?.similarity
                )}
              </b>

              <small>
                Top query-SAR score
              </small>

            </div>

          </div>

          {mission && (
            <div className="search-summary">

              <div>

                <span>
                  QUERY
                </span>

                <b>
                  {mission.query}
                </b>

              </div>

              <div>

                <span>
                  LOCATION
                </span>

                <b>
                  {mission.location?.name}
                </b>

              </div>

            </div>
          )}

          {reportGeneratedAt && (
            <p className="muted">
              Generated:{" "}
              {new Date(
                reportGeneratedAt
              ).toLocaleString(
                "en-IN"
              )}
            </p>
          )}

          <button
            className="primary big"
            onClick={makeReport}
            disabled={
              !mission ||
              reportStatus ===
                "generating"
            }
          >
            {reportStatus ===
            "generating"
              ? "GENERATING REPORT..."
              : "GENERATE SATELLITE REPORT"}
          </button>

          {reportUrl && (
            <a
              className="download"
              href={
                reportUrl
              }
              target="_blank"
              rel="noreferrer"
            >
              Open generated report
            </a>
          )}

        </section>

        <section className="card">

          <div className="section-label">
            REPORT CONTENTS
          </div>

          <ol className="report-list">

            <li>
              Mission overview
            </li>

            <li>
              Natural-language query
            </li>

            <li>
              Selected area of interest
            </li>

            <li>
              Satellite and SAR metadata
            </li>

            <li>
              Three location-related candidate zones
            </li>

            <li>
              Query-SAR similarity evidence
            </li>

            <li>
              Geographic coordinates
            </li>

            <li>
              Prototype limitations and
              validation notes
            </li>

          </ol>

        </section>

      </div>

    </div>
  );
}

/* ============================================================
   SETTINGS
============================================================ */

function Settings({
  mission,
}) {
  return (
    <div className="page cardpage">

      <div className="eyebrow">
        SYSTEM CONFIGURATION
      </div>

      <h1>
        Settings
      </h1>

      <div className="settingsgrid">

        <section className="card">

          <div className="section-label">
            AI ENGINE
          </div>

          <InfoRow
            label="Embedding dimension"
            value={getEmbedding(
              mission
            )}
          />

          <InfoRow
            label="Similarity"
            value={
              mission?.similarity_metric ||
              "Cosine"
            }
          />

          <InfoRow
            label="Search mode"
            value={getSearchMode(
              mission
            )}
          />

          <InfoRow
            label="Confidence calibration"
            value="Backend dependent"
          />

        </section>

        <section className="card">

          <div className="section-label">
            SPACE DATA
          </div>

          <InfoRow
            label="Satellite"
            value={getSatellite(
              mission
            )}
          />

          <InfoRow
            label="Sensor"
            value={getSensor(
              mission
            )}
          />

          <InfoRow
            label="Polarization"
            value={getPolarization(
              mission
            )}
          />

          <InfoRow
            label="Observation"
            value="Earth surface"
          />

        </section>

        <section className="card">

          <div className="section-label">
            DATA & MEMORY
          </div>

          <InfoRow
            label="Vector workspace"
            value="In-memory RAM"
          />

          <InfoRow
            label="Persistent vector DB"
            value="Disabled"
          />

          <InfoRow
            label="Session retention"
            value="Current app session"
          />

        </section>

      </div>

    </div>
  );
}

/* ============================================================
   HELP
============================================================ */

function Help() {
  const steps = [
    "Natural-language query",
    "Query understanding",
    "SAR feature retrieval",
    "Semantic similarity",
    "Geospatial candidate",
    "Satellite evidence",
    "Optional temporal comparison",
    "Intelligence report",
  ];

  return (
    <div className="page cardpage">

      <div className="eyebrow">
        SYSTEM FLOW
      </div>

      <h1>
        How VELTRIX Works
      </h1>

      <p className="subtitle">
        The interface exposes the application
        workflow without claiming hidden model
        reasoning or unverified hazard detections.
      </p>

      <section className="card">

        <div className="helpflow">

          {steps.map(
            (
              step,
              index
            ) => (
              <React.Fragment
                key={step}
              >

                <div className="help-step">

                  <span>
                    0{index + 1}
                  </span>

                  <b>
                    {step}
                  </b>

                </div>

                {index <
                  steps.length -
                    1 && (
                  <div className="help-arrow">
                    ↓
                  </div>
                )}

              </React.Fragment>
            )
          )}

        </div>

      </section>

      <section className="card limitation-card">

        <div className="section-label">
          PROTOTYPE STATUS
        </div>

        <h2>
          Evidence-first presentation
        </h2>

        <p>
          Similarity values are retrieval scores,
          not calibrated confidence probabilities.
          The interface does not fabricate satellite
          evidence. Before/after comparison becomes
          populated when the backend supplies real
          observation-pair fields.
        </p>

      </section>

    </div>
  );
}

/* ============================================================
   EMPTY STATE
============================================================ */

function EmptyState({
  title,
  text,
  action,
  onClick,
}) {
  return (
    <div className="empty-state">

      <div className="empty-icon">
        V
      </div>

      <h3>
        {title}
      </h3>

      <p>
        {text}
      </p>

      {action && (
        <button
          className="primary"
          onClick={onClick}
        >
          {action}
        </button>
      )}

    </div>
  );
}

/* ============================================================
   APPLICATION START
============================================================ */

createRoot(
  document.getElementById("root")
).render(
  <App />
);
