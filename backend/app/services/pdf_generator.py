"""
PDF Generation Service using WeasyPrint
Converts HTML templates to PDF for medical reports
"""
from weasyprint import HTML, CSS
from jinja2 import Template
from typing import Dict, Any
from datetime import datetime
import os


def get_patient_report_template() -> str:
    """HTML template for patient-friendly reports"""
    return """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>MIDAS Medical Report - {{ report_number }}</title>
    <style>
        @page {
            size: A4;
            margin: 2cm;
            @bottom-right {
                content: "Page " counter(page) " of " counter(pages);
                font-size: 10px;
                color: #666;
            }
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
        }

        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 3px solid #4CAF50;
        }

        .header h1 {
            color: #2E7D32;
            margin: 0;
            font-size: 28px;
        }

        .header p {
            color: #666;
            margin: 5px 0;
        }

        .report-number {
            background: #E8F5E9;
            padding: 10px;
            border-radius: 5px;
            text-align: center;
            font-weight: bold;
            margin: 20px 0;
        }

        .section {
            margin: 25px 0;
            page-break-inside: avoid;
        }

        .section-title {
            background: #4CAF50;
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 15px;
        }

        .info-box {
            background: #F5F5F5;
            border-left: 4px solid #4CAF50;
            padding: 15px;
            margin: 15px 0;
        }

        .confidence-indicator {
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            font-weight: bold;
            color: white;
        }

        .confidence-high { background: #4CAF50; }
        .confidence-medium { background: #FF9800; }
        .confidence-low { background: #F44336; }

        .risk-badge {
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            font-weight: bold;
            color: white;
            text-transform: uppercase;
        }

        .risk-low { background: #4CAF50; }
        .risk-medium { background: #FF9800; }
        .risk-high { background: #F44336; }

        .features-list {
            list-style: none;
            padding: 0;
        }

        .features-list li {
            padding: 8px 12px;
            margin: 5px 0;
            background: #FFF3E0;
            border-left: 3px solid #FF9800;
        }

        .recommendations {
            background: #E3F2FD;
            border: 2px solid #2196F3;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }

        .recommendations ul {
            margin: 10px 0;
            padding-left: 20px;
        }

        .recommendations li {
            margin: 8px 0;
        }

        .disclaimer {
            background: #FFF9C4;
            border: 2px solid #FBC02D;
            border-radius: 8px;
            padding: 15px;
            margin-top: 30px;
            font-size: 12px;
        }

        .disclaimer strong {
            color: #F57C00;
        }

        .heatmap-container {
            text-align: center;
            margin: 20px 0;
            page-break-inside: avoid;
        }

        .heatmap-container img {
            max-width: 400px;
            border: 2px solid #ddd;
            border-radius: 8px;
        }

        .summary {
            font-size: 14px;
            line-height: 1.8;
            text-align: justify;
        }

        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #ddd;
            text-align: center;
            color: #666;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔬 {{ report_title }}</h1>
        <p>{{ report_subtitle }}</p>
        <p><strong>Generated:</strong> {{ generated_date }}</p>
    </div>

    <div class="report-number">
        Report Number: {{ report_number }}
    </div>

    <div class="section">
        <div class="section-title">📋 Analysis Results</div>
        <div class="info-box">
            <p><strong>Diagnosis:</strong> {{ diagnosis }}</p>
            <p><strong>Confidence:</strong>
                <span class="confidence-indicator confidence-{{ confidence_class }}">
                    {{ confidence }}%
                </span>
            </p>
            <p><strong>Risk Level:</strong>
                <span class="risk-badge risk-{{ risk_level }}">
                    {{ risk_level }}
                </span>
            </p>
            <p><strong>Analysis Date:</strong> {{ analysis_date }}</p>
        </div>
    </div>

    {% if heatmap_url and config.includeImages %}
    <div class="section">
        <div class="section-title">🔍 Visual Analysis</div>
        <div class="heatmap-container">
            <img src="{{ heatmap_url }}" alt="AI Heatmap Analysis">
            <p style="font-size: 12px; color: #666; margin-top: 10px;">
                This heatmap shows the areas the AI focused on during analysis
            </p>
        </div>
    </div>
    {% endif %}

    {% if detected_features and config.includeDetailedFeatures %}
    <div class="section">
        <div class="section-title">🔬 Detected Features</div>
        <ul class="features-list">
            {% for feature in detected_features %}
            <li>{{ feature }}</li>
            {% endfor %}
        </ul>
    </div>
    {% endif %}

    <div class="section">
        <div class="section-title">📝 Report Summary</div>
        <div class="summary">
            {{ llm_summary | safe }}
        </div>
    </div>

    {% if config.includeRecommendations %}
    <div class="section">
        <div class="section-title">⚕️ What You Should Do Next</div>
        <div class="recommendations">
            <strong style="color: #1565C0;">Important Next Steps:</strong>
            {% if llm_recommendations %}
                <div style="margin-top: 10px;">{{ llm_recommendations | safe }}</div>
            {% else %}
                <ul>
                    {% for rec in recommendations %}
                    <li>{{ rec }}</li>
                    {% endfor %}
                </ul>
            {% endif %}
        </div>
    </div>
    {% endif %}

    {% if config.includeDisclaimer %}
    <div class="disclaimer">
        <strong>⚠️ Important Medical Disclaimer:</strong><br>
        This report is generated by an AI-assisted screening tool and is NOT a medical diagnosis.
        It should be used as supplementary information only. Always consult with a qualified
        dermatologist or healthcare professional for proper evaluation, diagnosis, and treatment.
        Do not delay seeking medical attention based on this report.
    </div>
    {% endif %}

    <div class="footer">
        <p>MIDAS - Medical Image Diagnostic AI System</p>
        <p>Report ID: {{ report_id }} | Generated: {{ generated_date }}</p>
    </div>
</body>
</html>
    """


def get_clinician_report_template() -> str:
    """HTML template for clinical/technical reports"""
    return """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>MIDAS Clinical Report - {{ report_number }}</title>
    <style>
        @page {
            size: A4;
            margin: 2cm;
            @bottom-right {
                content: "Page " counter(page) " of " counter(pages);
                font-size: 9px;
                color: #666;
            }
        }

        body {
            font-family: 'Times New Roman', serif;
            line-height: 1.5;
            color: #000;
            font-size: 11pt;
        }

        .header {
            text-align: center;
            margin-bottom: 25px;
            padding-bottom: 15px;
            border-bottom: 2px solid #1976D2;
        }

        .header h1 {
            color: #0D47A1;
            margin: 0;
            font-size: 24px;
        }

        .header p {
            color: #424242;
            margin: 3px 0;
            font-size: 10pt;
        }

        .report-metadata {
            background: #ECEFF1;
            padding: 12px;
            border-left: 4px solid #1976D2;
            margin: 20px 0;
            font-size: 10pt;
        }

        .section {
            margin: 20px 0;
            page-break-inside: avoid;
        }

        .section-title {
            background: #1976D2;
            color: white;
            padding: 8px 12px;
            font-size: 14pt;
            font-weight: bold;
            margin-bottom: 12px;
        }

        .subsection-title {
            color: #0D47A1;
            font-weight: bold;
            margin: 12px 0 6px 0;
            font-size: 12pt;
        }

        .data-table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
            font-size: 10pt;
        }

        .data-table th {
            background: #CFD8DC;
            padding: 8px;
            text-align: left;
            border: 1px solid #90A4AE;
            font-weight: bold;
        }

        .data-table td {
            padding: 8px;
            border: 1px solid #CFD8DC;
        }

        .metrics-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin: 15px 0;
        }

        .metric-box {
            background: #F5F5F5;
            padding: 10px;
            border-left: 3px solid #1976D2;
        }

        .metric-box .label {
            font-size: 9pt;
            color: #666;
            text-transform: uppercase;
        }

        .metric-box .value {
            font-size: 14pt;
            font-weight: bold;
            color: #0D47A1;
        }

        .heatmap-container {
            text-align: center;
            margin: 20px 0;
            page-break-inside: avoid;
        }

        .heatmap-container img {
            max-width: 450px;
            border: 1px solid #90A4AE;
        }

        .clinical-text {
            text-align: justify;
            margin: 10px 0;
            line-height: 1.6;
        }

        .features-list {
            columns: 2;
            -webkit-columns: 2;
            -moz-columns: 2;
            margin: 10px 0;
        }

        .features-list li {
            break-inside: avoid;
            page-break-inside: avoid;
            margin: 4px 0;
        }

        .clinical-note {
            background: #FFF3E0;
            border: 1px solid #FFB74D;
            padding: 12px;
            margin: 15px 0;
            font-size: 10pt;
        }

        .disclaimer {
            background: #FFEBEE;
            border: 2px solid #E53935;
            padding: 12px;
            margin-top: 25px;
            font-size: 9pt;
        }

        .footer {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #BDBDBD;
            text-align: center;
            font-size: 9pt;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>MIDAS Clinical Analysis Report</h1>
        <p>AI-Assisted Dermatological Screening System</p>
        <p><strong>Report Date:</strong> {{ generated_date }}</p>
    </div>

    <div class="report-metadata">
        <strong>Report Number:</strong> {{ report_number }}<br>
        <strong>Report ID:</strong> {{ report_id }}<br>
        <strong>Analysis Date:</strong> {{ analysis_date }}<br>
        <strong>Patient ID:</strong> {{ user_id }}
    </div>

    <div class="section">
        <div class="section-title">I. DIAGNOSTIC IMPRESSION</div>
        <table class="data-table">
            <tr>
                <th>Parameter</th>
                <th>Value</th>
            </tr>
            <tr>
                <td><strong>Primary Diagnosis</strong></td>
                <td>{{ diagnosis }}</td>
            </tr>
            <tr>
                <td><strong>Model Confidence</strong></td>
                <td>{{ confidence }}%</td>
            </tr>
            <tr>
                <td><strong>Risk Stratification</strong></td>
                <td style="text-transform: uppercase; font-weight: bold;">{{ risk_level }}</td>
            </tr>
        </table>
    </div>

    <div class="section">
        <div class="section-title">II. CLASSIFICATION METRICS</div>
        <div class="metrics-grid">
        <div class="metric-box">
            <div class="label">Precision</div>
            <div class="value">{{ metric_display.precision }}</div>
        </div>
        <div class="metric-box">
            <div class="label">Recall (Sensitivity)</div>
            <div class="value">{{ metric_display.recall }}</div>
        </div>
        <div class="metric-box">
            <div class="label">F1-Score</div>
            <div class="value">{{ metric_display.f1_score }}</div>
        </div>
        <div class="metric-box">
            <div class="label">AUC-ROC</div>
            <div class="value">{{ metric_display.auc_roc }}</div>
        </div>
        <div class="metric-box">
            <div class="label">Specificity</div>
            <div class="value">{{ metric_display.specificity }}</div>
        </div>
        <div class="metric-box">
            <div class="label">Sensitivity</div>
            <div class="value">{{ metric_display.sensitivity }}</div>
        </div>
        <div class="metric-box">
            <div class="label">PPV (Positive Predictive Value)</div>
            <div class="value">{{ metric_display.ppv }}</div>
        </div>
        <div class="metric-box">
            <div class="label">NPV (Negative Predictive Value)</div>
            <div class="value">{{ metric_display.npv }}</div>
        </div>
        </div>
    </div>

    {% if heatmap_url and config.includeImages %}
    <div class="section">
        <div class="section-title">III. GRAD-CAM VISUALIZATION</div>
        <div class="heatmap-container">
            <img src="{{ heatmap_url }}" alt="Grad-CAM Heatmap">
            <p style="font-size: 9pt; color: #666; margin-top: 8px;">
                Figure 1: Gradient-weighted Class Activation Mapping highlighting regions of diagnostic significance
            </p>
        </div>
    </div>
    {% endif %}

    {% if detected_features and config.includeDetailedFeatures %}
    <div class="section">
        <div class="section-title">IV. MORPHOLOGICAL FEATURES</div>
        <ul class="features-list">
            {% for feature in detected_features %}
            <li>{{ feature }}</li>
            {% endfor %}
        </ul>
    </div>
    {% endif %}

    <div class="section">
        <div class="section-title">V. CLINICAL INTERPRETATION</div>
        <div class="clinical-text">
            {{ llm_summary | safe }}
        </div>
    </div>

    {% if config.includeRecommendations %}
    <div class="section">
        <div class="section-title">VI. CLINICAL RECOMMENDATIONS</div>
        {% if llm_recommendations %}
            <div class="clinical-text">{{ llm_recommendations | safe }}</div>
        {% else %}
            <ul>
                {% for rec in recommendations %}
                <li>{{ rec }}</li>
                {% endfor %}
            </ul>
        {% endif %}
    </div>
    {% endif %}

    <div class="clinical-note">
        <strong>Clinical Correlation Required:</strong> This AI-generated report should be used in conjunction with
        clinical examination, patient history, and additional diagnostic testing as clinically indicated.
        The system provides screening support but does not replace clinical judgment.
    </div>

    {% if config.includeDisclaimer %}
    <div class="disclaimer">
        <strong>DISCLAIMER:</strong> This report is generated by an AI-assisted diagnostic support system
        and does not constitute a medical diagnosis. Clinical correlation, physical examination, and
        additional testing are required for definitive diagnosis. This tool is intended for use by
        qualified healthcare professionals as an adjunct to clinical decision-making.
    </div>
    {% endif %}

    <div class="footer">
        <p>MIDAS - Medical Image Diagnostic AI System v1.0</p>
        <p>Report Generated: {{ generated_date }} | Report ID: {{ report_id }}</p>
    </div>
</body>
</html>
    """


def generate_pdf(report_data: Dict[str, Any], report_type: str) -> bytes:
    """
    Generate PDF from report data

    Args:
        report_data: Dictionary containing all report information
        report_type: 'patient_report' or 'clinician_report'

    Returns:
        PDF as bytes
    """
    try:
        # Select appropriate template
        if report_type == "clinician_report":
            template_html = get_clinician_report_template()
        else:
            template_html = get_patient_report_template()

        # Create Jinja2 template
        template = Template(template_html)

        # Prepare template context
        analysis = report_data["analysis"]
        config = report_data["config"]

        # Calculate confidence class for styling
        confidence = analysis.get("confidence", 0)
        if confidence >= 80:
            confidence_class = "high"
        elif confidence >= 60:
            confidence_class = "medium"
        else:
            confidence_class = "low"

        # Format metrics
        metrics = analysis.get("classification_metrics", {})
        if isinstance(metrics, str):
            import json
            metrics = json.loads(metrics)

        metric_keys = [
            "precision",
            "recall",
            "f1_score",
            "auc_roc",
            "specificity",
            "sensitivity",
            "ppv",
            "npv"
        ]
        metric_display = {}
        for key in metric_keys:
            value = metrics.get(key) if isinstance(metrics, dict) else None
            metric_display[key] = f"{value:.3f}" if isinstance(value, (int, float)) else "N/A"

        report_title = "MIDAS Medical Report"
        report_subtitle = "AI-Assisted Skin Lesion Analysis"
        if report_type == "diagnostic_summary":
            report_title = "MIDAS Diagnostic Summary"
        elif report_type == "detailed_analysis":
            report_title = "MIDAS Detailed Analysis"
        elif report_type == "patient_report":
            report_title = "MIDAS Patient Report"

        context = {
            "report_id": report_data["report_id"],
            "report_number": "MIDAS-REP-" + str(datetime.now().strftime("%y%m%d%H%M")),
            "generated_date": datetime.now().strftime("%B %d, %Y at %I:%M %p"),
            "analysis_date": analysis.get("created_at", datetime.now().isoformat())[:10],
            "user_id": report_data["user_id"],
            "diagnosis": analysis.get("diagnosis", "Unknown"),
            "confidence": f"{confidence:.1f}",
            "confidence_class": confidence_class,
            "risk_level": analysis.get("risk_level", "unknown").lower(),
            "detected_features": analysis.get("detected_features", []),
            "recommendations": analysis.get("recommendations", []),
            "heatmap_url": report_data.get("heatmap_url"),
            "llm_summary": report_data.get("llm_summary", ""),
            "llm_recommendations": report_data.get("llm_recommendations", ""),
            "metric_display": metric_display,
            "config": config,
            "report_title": report_title,
            "report_subtitle": report_subtitle
        }

        # Render HTML
        html_content = template.render(**context)

        # Convert HTML to PDF using WeasyPrint
        pdf_bytes = HTML(string=html_content).write_pdf()

        return pdf_bytes

    except Exception as e:
        print(f"Error generating PDF: {str(e)}")
        raise
