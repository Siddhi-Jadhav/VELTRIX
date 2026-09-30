from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field
from pathlib import Path

import numpy as np
import uuid
import json

from datetime import datetime, timezone
from urllib.parse import quote
from urllib.request import Request, urlopen

from report import build_report


app = FastAPI(
    title="VELTRIX SAR Intelligence API",
    version="1.0.0"
)


app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],
)


REPORT_DIR = (
    Path(__file__).parent /
    "generated_reports"
)

REPORT_DIR.mkdir(exist_ok=True)


# =========================================================
# TEMPORARY SESSION STORAGE
# =========================================================

TEMP_SESSIONS = {}


# =========================================================
# FIVE DATASETS
# =========================================================

DATASETS = [

    "BigEarthNet-MM",

    "SEN12MS-CR",

    "RS5M",

    "SARLO-80",

    "SAR-Text",

]


# =========================================================
# DEMO SAR ZONES
# =========================================================

DEMO_ZONES = [

    {
        "id":"ZONE 01",

        "hazard":"Water-logging",

        "lat":18.5204,

        "lon":73.8567,

        "similarity":0.931,

        "confidence":94.2,

        "patch_id":"S1_P0148",

        "bbox":[
            18.5197,
            73.8558,
            18.5211,
            73.8576
        ],

        "patch_size":"256 × 256",

        "acquisition_time":
            "2026-09-20T14:32:00Z",

        "satellite":
            "Sentinel-1",

        "provider":
            "Copernicus Data Space Ecosystem",

        "polarization":
            "VV + VH",

        "orbit":
            "Descending",

        "incidence_angle":
            "36.8°",

        "backscatter":{
            "vv_mean_db":-12.4,
            "vh_mean_db":-19.1,
            "vv_std_db":4.8,
            "vh_std_db":3.1
        },

        "spatial_evidence":[

            "High local backscatter variation",

            "Connected surface anomaly",

            "Pattern spatially consistent with water-logging query",

            "Candidate region falls inside selected AOI"

        ],

        "quality_flags":[

            "Geolocation available",

            "Patch complete",

            "Demo metadata"

        ],

        "dataset_alignment":DATASETS,

        "validation":
            "AI candidate — operational validation required"

    },


    {
        "id":"ZONE 02",

        "hazard":"Water-logging",

        "lat":18.5182,

        "lon":73.8611,

        "similarity":0.887,

        "confidence":89.7,

        "patch_id":"S1_P0121",

        "bbox":[
            18.5175,
            73.8602,
            18.5189,
            73.8620
        ],

        "patch_size":"256 × 256",

        "acquisition_time":
            "2026-09-20T14:32:00Z",

        "satellite":
            "Sentinel-1",

        "provider":
            "Copernicus Data Space Ecosystem",

        "polarization":
            "VV + VH",

        "orbit":
            "Descending",

        "incidence_angle":
            "37.1°",

        "backscatter":{
            "vv_mean_db":-13.2,
            "vh_mean_db":-19.8,
            "vv_std_db":4.3,
            "vh_std_db":3.0
        },

        "spatial_evidence":[

            "Local radar texture anomaly",

            "Spatially coherent candidate region",

            "Semantic match with water-logging concept"

        ],

        "quality_flags":[

            "Geolocation available",

            "Patch complete",

            "Demo metadata"

        ],

        "dataset_alignment":DATASETS,

        "validation":
            "AI candidate — operational validation required"

    },


    {
        "id":"ZONE 03",

        "hazard":"Water-logging",

        "lat":18.5241,

        "lon":73.8502,

        "similarity":0.842,

        "confidence":85.4,

        "patch_id":"S1_P0094",

        "bbox":[
            18.5234,
            73.8493,
            18.5248,
            73.8511
        ],

        "patch_size":"256 × 256",

        "acquisition_time":
            "2026-09-20T14:32:00Z",

        "satellite":
            "Sentinel-1",

        "provider":
            "Copernicus Data Space Ecosystem",

        "polarization":
            "VV + VH",

        "orbit":
            "Descending",

        "incidence_angle":
            "37.6°",

        "backscatter":{
            "vv_mean_db":-14.0,
            "vh_mean_db":-20.2,
            "vv_std_db":3.9,
            "vh_std_db":2.8
        },

        "spatial_evidence":[

            "Surface response differs from nearby background",

            "Candidate geometry matches query representation",

            "Located inside AOI"

        ],

        "quality_flags":[

            "Geolocation available",

            "Patch complete",

            "Demo metadata"

        ],

        "dataset_alignment":DATASETS,

        "validation":
            "AI candidate — operational validation required"

    }

]


# =========================================================
# REQUEST MODELS
# =========================================================

class LocationModel(BaseModel):

    name: str = (
        "Pune, Maharashtra, India"
    )

    lat: float = 18.5204

    lon: float = 73.8567


class MissionRequest(BaseModel):

    mission_name: str = (
        "Flood Assessment"
    )

    query: str = Field(
        ...,
        min_length=3
    )

    location: LocationModel = LocationModel()

    aoi: dict = {}

    mode: str = "demo"


class SearchRequest(MissionRequest):

    top_k: int = 5


# =========================================================
# HEALTH
# =========================================================

@app.get("/api/health")
def health():

    return {

        "status":"online",

        "team":"VELTRIX$",

        "ai_engine":"ready",

        "map_engine":"ready",

        "memory_mode":"temporary",

    }


# =========================================================
# DATASETS
# =========================================================

@app.get("/api/datasets")
def datasets():

    return {

        "datasets":DATASETS,

        "combined_alignment":True

    }


# =========================================================
# GEOCODING
# =========================================================

@app.get("/api/geocode")
def geocode(q: str):

    """
    Convert a place name into latitude/longitude.

    Prototype implementation uses OpenStreetMap Nominatim.

    Production deployment should use an approved geocoding
    provider and follow its usage limits and terms.
    """

    q = q.strip()


    if not q:

        return {
            "results":[]
        }


    # -----------------------------------------------------
    # DIRECT COORDINATE INPUT
    #
    # Example:
    # 18.5204, 73.8567
    # -----------------------------------------------------

    try:

        parts = [
            float(x.strip())
            for x in q.split(",")
        ]

        if (

            len(parts) == 2

            and
            -90 <= parts[0] <= 90

            and
            -180 <= parts[1] <= 180

        ):

            return {

                "results":[

                    {

                        "display_name":
                            (
                                "Coordinate AOI "
                                f"({parts[0]:.6f}, "
                                f"{parts[1]:.6f})"
                            ),

                        "lat":parts[0],

                        "lon":parts[1],

                        "type":"coordinate"

                    }

                ]

            }

    except ValueError:

        pass


    # -----------------------------------------------------
    # OPENSTREETMAP NOMINATIM
    # -----------------------------------------------------

    url = (

        "https://nominatim.openstreetmap.org/search"

        "?format=jsonv2"

        "&limit=5"

        "&addressdetails=1"

        "&q="

        +
        quote(q)

    )


    request = Request(

        url,

        headers={

            "User-Agent":
                "VELTRIX-SAR-Intelligence/1.0 (prototype)"

        }

    )


    try:

        with urlopen(
            request,
            timeout=8
        ) as response:

            raw = (
                response
                .read()
                .decode("utf-8")
            )


        data = json.loads(raw)


        results = [

            {

                "display_name":
                    item.get(
                        "display_name",
                        q
                    ),

                "lat":
                    float(item["lat"]),

                "lon":
                    float(item["lon"]),

                "type":
                    item.get(
                        "type",
                        "place"
                    )

            }

            for item in data

            if (

                item.get("lat")
                is not None

                and

                item.get("lon")
                is not None

            )

        ]


        return {

            "results":results

        }


    except Exception as exc:

        return JSONResponse(

            status_code=502,

            content={

                "detail":
                    "Geocoding service unavailable.",

                "error":
                    str(exc)

            }

        )


# =========================================================
# CREATE MISSION
# =========================================================

@app.post("/api/mission")
def create_mission(
    req: MissionRequest
):

    mission_id = (

        f"SAT-"

        f"{datetime.now().strftime('%Y%m%d')}"

        f"-"

        f"{uuid.uuid4().hex[:6].upper()}"

    )


    TEMP_SESSIONS[mission_id] = {

        "query":
            req.query,

        "location":
            req.location.model_dump(),

        "aoi":
            req.aoi,

        "created":
            datetime.now(
                timezone.utc
            ).isoformat(),

        "patch_count":
            148,

        # Demo 512-D matrix.
        # Replace with trained encoder
        # outputs in production.

        "sar_matrix":
            np.random.default_rng(7)
            .normal(
                size=(148,512)
            )
            .astype(
                np.float32
            )

    }


    return {

        "mission_id":
            mission_id,

        "mission_name":
            req.mission_name,

        "query":
            req.query,

        "location":
            req.location.model_dump(),

        "aoi":
            req.aoi,

        "status":
            "created",

        "datasets":
            DATASETS,

        "source":
            (
                "Sentinel-1 / "
                "Copernicus Data Space Ecosystem"
            )

    }


# =========================================================
# LOCATION-AWARE SAR SEARCH
# =========================================================

@app.post("/api/search")
def search(
    req: SearchRequest
):

    mission_id = (

        f"SAT-"

        f"{datetime.now().strftime('%Y%m%d')}"

        f"-"

        f"{uuid.uuid4().hex[:6].upper()}"

    )


    # -----------------------------------------------------
    # DEMO EMBEDDING PIPELINE
    # -----------------------------------------------------

    rng = np.random.default_rng(7)


    sar_matrix = (

        rng.normal(
            size=(148,512)
        )
        .astype(np.float32)

    )


    query_vec = (

        rng.normal(
            size=(512,)
        )
        .astype(np.float32)

    )


    q = (

        query_vec /
        np.linalg.norm(query_vec)

    )


    m = (

        sar_matrix /
        np.linalg.norm(
            sar_matrix,
            axis=1,
            keepdims=True
        )

    )


    similarities = m @ q


    # -----------------------------------------------------
    # DEMO PRESENTATION RESULTS
    # -----------------------------------------------------

    zones = DEMO_ZONES[
        :max(
            1,
            min(
                req.top_k,
                3
            )
        )
    ]


    # -----------------------------------------------------
    # TEMPORARY SESSION
    # -----------------------------------------------------

    TEMP_SESSIONS[mission_id] = {

        "query":
            req.query,

        "location":
            req.location.model_dump(),

        "aoi":
            req.aoi,

        "created":
            datetime.now(
                timezone.utc
            ).isoformat(),

        "patch_count":
            148,

        "sar_matrix":
            sar_matrix,

        "query_vector":
            query_vec

    }


    # -----------------------------------------------------
    # RESPONSE
    # -----------------------------------------------------

    return {

        "mission_id":
            mission_id,

        "query":
            req.query,

        "location":
            req.location.model_dump(),

        "aoi":
            req.aoi,

        "patches_processed":
            148,

        "embedding_dimension":
            512,

        "similarity_metric":
            "Cosine Similarity",

        "search_mode":
            "Top-K Retrieval",

        "persistent_vector_db":
            False,

        "zones":
            zones,

        "top_k_scores":[

            0.931,

            0.887,

            0.842,

            0.801,

            0.774

        ],

        "processing_ms":
            1.8,

        "processing_note":
            (
                "DEMO benchmark value; "
                "replace with measured "
                "deployment latency."
            ),

        "datasets":
            DATASETS

    }


# =========================================================
# MISSION DETAILS
# =========================================================

@app.get("/api/mission/{mission_id}")
def mission(
    mission_id: str
):

    if mission_id not in TEMP_SESSIONS:

        return JSONResponse(

            status_code=404,

            content={
                "detail":
                    "Mission not found in temporary session."
            }

        )


    s = TEMP_SESSIONS[
        mission_id
    ]


    return {

        "mission_id":
            mission_id,

        "query":
            s["query"],

        "location":
            s.get("location"),

        "aoi":
            s["aoi"],

        "patch_count":
            s["patch_count"],

        "embedding_dimension":
            512,

        "memory_mode":
            "RAM"

    }


# =========================================================
# CLEAR MISSION
# =========================================================

@app.post(
    "/api/mission/{mission_id}/clear"
)
def clear_mission(
    mission_id: str
):

    TEMP_SESSIONS.pop(
        mission_id,
        None
    )


    return {

        "mission_id":
            mission_id,

        "cleared":
            True,

        "message":
            "Temporary session state released."

    }


# =========================================================
# ZONE EVIDENCE
# =========================================================

@app.get(
    "/api/zone/{zone_id}"
)
def zone_evidence(
    zone_id: str
):

    for zone in DEMO_ZONES:

        if zone["id"] == zone_id:

            return {

                **zone,

                "evidence_chain":{

                    "query_embedding":
                        "512-D",

                    "sar_embedding":
                        "512-D",

                    "shared_latent_space":
                        True,

                    "retrieval_metric":
                        "Cosine Similarity",

                    "retrieval_mode":
                        (
                            "Top-K in-memory "
                            "matrix search"
                        ),

                    "persistent_vector_database":
                        False

                }

            }


    return JSONResponse(

        status_code=404,

        content={
            "detail":
                "Zone not found."
        }

    )


# =========================================================
# PDF REPORT
# =========================================================

@app.post("/api/report")
def report(
    req: SearchRequest
):

    mission_id = (

        f"SAT-"

        f"{datetime.now().strftime('%Y%m%d')}"

        f"-"

        f"{uuid.uuid4().hex[:6].upper()}"

    )


    pdf_path = (

        REPORT_DIR /

        f"{mission_id}_VELTRIX_Intelligence_Report.pdf"

    )


    build_report(

        output_path=pdf_path,

        mission_id=mission_id,

        query=req.query,

        aoi={

            **req.aoi,

            "location":
                req.location.model_dump()

        },

        zones=DEMO_ZONES,

        datasets=DATASETS

    )


    return {

        "mission_id":
            mission_id,

        "filename":
            pdf_path.name,

        "download_url":
            f"/api/report/{pdf_path.name}"

    }


# =========================================================
# DOWNLOAD REPORT
# =========================================================

@app.get(
    "/api/report/{filename}"
)
def download_report(
    filename: str
):

    path = (

        REPORT_DIR /

        Path(filename).name

    )


    if not path.exists():

        return JSONResponse(

            status_code=404,

            content={
                "detail":
                    "Report not found."
            }

        )


    return FileResponse(

        path,

        media_type="application/pdf",

        filename=path.name

    )
