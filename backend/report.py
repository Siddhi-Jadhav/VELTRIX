from reportlab.lib.pagesizes import A4
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak
)
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.units import mm


def build_report(output_path, mission_id, query, aoi, zones, datasets):

    # =========================================================
    # REPORT BACKGROUND
    # =========================================================
    PAGE_BACKGROUND = colors.HexColor("#eaf4ff")

    styles = getSampleStyleSheet()

    title = ParagraphStyle(
        "TitleV",
        parent=styles["Title"],
        fontSize=24,
        textColor=colors.HexColor("#E8E3FF"),
        alignment=TA_CENTER
    )

    h = ParagraphStyle(
        "HV",
        parent=styles["Heading2"],
        textColor=colors.HexColor("#D4DDF5")
    )

    body = styles["BodyText"]

    # =========================================================
    # PAGE BACKGROUND
    # =========================================================
    def draw_page_background(canvas, doc):
        canvas.saveState()

        canvas.setFillColor(PAGE_BACKGROUND)

        canvas.rect(
            0,
            0,
            A4[0],
            A4[1],
            fill=1,
            stroke=0
        )

        canvas.restoreState()

    # =========================================================
    # DOCUMENT
    # =========================================================
    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=A4,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm
    )

    # =========================================================
    # REPORT CONTENT
    # =========================================================
    story = [
        Paragraph("VELTRIX$", title),

        Paragraph(
            "Emergency SAR Intelligence Report",
            styles["Heading1"]
        ),

        Paragraph(
            f"<b>Mission:</b> {mission_id}",
            body
        ),

        Paragraph(
            f"<b>Query:</b> {query}",
            body
        ),

        Paragraph(
            "<b>Interpretation:</b> AI candidate retrieval; "
            "operational validation required.",
            body
        ),

        Spacer(1, 8),

        Paragraph(
            "1. Coordinate-First Detection Summary",
            h
        )
    ]

    # =========================================================
    # DETECTION SUMMARY TABLE
    # =========================================================
    data = [
        [
            "Zone",
            "Hazard",
            "Latitude",
            "Longitude",
            "Similarity",
            "Confidence",
            "Patch"
        ]
    ] + [
        [
            z["id"],
            z["hazard"],
            f'{z["lat"]:.6f}° N',
            f'{z["lon"]:.6f}° E',
            f'{z["similarity"]:.3f}',
            f'{z["confidence"]:.1f}%',
            z["patch_id"]
        ]
        for z in zones
    ]

    tab = Table(
        data,
        repeatRows=1
    )

    tab.setStyle(
        TableStyle([
            (
                "BACKGROUND",
                (0, 0),
                (-1, 0),
                colors.HexColor("#E5EBFF")
            ),
            (
                "TEXTCOLOR",
                (0, 0),
                (-1, 0),
                colors.white
            ),
            (
                "GRID",
                (0, 0),
                (-1, -1),
                0.4,
                colors.HexColor("#BFC7E8")
            ),
            (
                "FONTSIZE",
                (0, 0),
                (-1, -1),
                7
            )
        ])
    )

    story += [
        tab,
        PageBreak(),
        Paragraph(
            "2. Detailed Evidence Per Zone",
            h
        )
    ]

    # =========================================================
    # DETAILED ZONE INFORMATION
    # =========================================================
    for z in zones:

        story += [
            Paragraph(
                f'{z["id"]} — {z["hazard"]}',
                styles["Heading3"]
            ),

            Paragraph(
                f'<b>Coordinate:</b> '
                f'{z["lat"]:.6f}° N, '
                f'{z["lon"]:.6f}° E'
                f'<br/>'
                f'<b>Bounding box:</b> {z["bbox"]}'
                f'<br/>'
                f'<b>Patch:</b> {z["patch_id"]} '
                f'({z["patch_size"]})'
                f'<br/>'
                f'<b>Acquisition:</b> {z["acquisition_time"]}'
                f'<br/>'
                f'<b>Source:</b> {z["satellite"]} / '
                f'{z["provider"]}'
                f'<br/>'
                f'<b>Polarization:</b> {z["polarization"]} · '
                f'<b>Orbit:</b> {z["orbit"]} · '
                f'<b>Incidence:</b> {z["incidence_angle"]}'
                f'<br/>'
                f'<b>Cosine similarity:</b> '
                f'{z["similarity"]:.3f} · '
                f'<b>Model confidence:</b> '
                f'{z["confidence"]:.1f}%',
                body
            )
        ]

        # =====================================================
        # BACKSCATTER TABLE
        # =====================================================
        bs = z["backscatter"]

        bt = Table([
            [
                "Backscatter metric",
                "Value"
            ],
            [
                "VV mean",
                f'{bs["vv_mean_db"]} dB'
            ],
            [
                "VH mean",
                f'{bs["vh_mean_db"]} dB'
            ],
            [
                "VV std",
                f'{bs["vv_std_db"]} dB'
            ],
            [
                "VH std",
                f'{bs["vh_std_db"]} dB'
            ]
        ])

        bt.setStyle(
            TableStyle([
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, 0),
                    colors.HexColor("#E9E7FF")
                ),
                (
                    "GRID",
                    (0, 0),
                    (-1, -1),
                    0.4,
                    colors.HexColor("#BFC7E8")
                ),
                (
                    "FONTSIZE",
                    (0, 0),
                    (-1, -1),
                    8
                )
            ])
        )

        story += [
            Spacer(1, 5),
            bt,

            Paragraph(
                "<b>Spatial evidence:</b> "
                + "; ".join(z["spatial_evidence"]),
                body
            ),

            Paragraph(
                "<b>Quality:</b> "
                + "; ".join(z["quality_flags"]),
                body
            ),

            Paragraph(
                "<b>Validation:</b> "
                + z["validation"],
                body
            ),

            Spacer(1, 8)
        ]

    # =========================================================
    # AI PROCESSING TRACE
    # =========================================================
    story += [
        PageBreak(),

        Paragraph(
            "3. AI Processing Trace",
            h
        ),

        Paragraph(
            "Natural-language query → Text Encoder → 512-D vector → "
            "Shared Latent Space → SAR patch encoder → 512-D vector → "
            "Cosine Similarity → Top-K → Geolocation → Candidate zone.",
            body
        ),

        Spacer(1, 8),

        Paragraph(
            "4. Five-Dataset Offline Alignment",
            h
        ),

        Paragraph(
            "All five configured together: "
            + ", ".join(datasets)
            + ".",
            body
        ),

        Spacer(1, 8),

        Paragraph(
            "5. System Strengths",
            h
        ),

        Paragraph(
            "Natural-language SAR search; coordinate-first output; "
            "detailed SAR evidence; cross-modal alignment; temporary "
            "in-memory retrieval; PDF/GeoJSON export; explicit "
            "five-dataset provenance.",
            body
        ),

        Spacer(1, 8),

        Paragraph(
            "6. Operational Caveat",
            h
        ),

        Paragraph(
            "Similarity is a retrieval score and confidence is a "
            "model score unless calibrated. Candidate zones must be "
            "validated against authoritative products, field "
            "observations and mission procedures.",
            body
        )
    ]

    # =========================================================
    # BUILD PDF WITH LIGHT BACKGROUND
    # =========================================================
    doc.build(
        story,
        onFirstPage=draw_page_background,
        onLaterPages=draw_page_background
    )