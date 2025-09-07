import { type NextRequest, NextResponse } from "next/server"

// Mock database - in production this would be a real database
const mockAnalyses = new Map([
  [
    "AN2024001",
    {
      id: "AN2024001",
      patientId: "P001",
      imageUrl: "/uploads/AN2024001.jpg",
      predictions: {
        "Benign Nevus": 0.94,
        Melanoma: 0.04,
        "Dysplastic Nevus": 0.02,
      },
      primaryPrediction: "Benign Nevus",
      confidence: 94,
      riskLevel: "low",
      status: "completed",
      createdAt: "2024-01-15T14:30:00Z",
      processingTime: 1.8,
      modelVersion: "MIDAS-v2.1",
    },
  ],
  [
    "AN2024002",
    {
      id: "AN2024002",
      patientId: "P001",
      imageUrl: "/uploads/AN2024002.jpg",
      predictions: {
        Melanoma: 0.87,
        "Benign Nevus": 0.08,
        "Dysplastic Nevus": 0.05,
      },
      primaryPrediction: "Melanoma",
      confidence: 87,
      riskLevel: "high",
      status: "reviewed",
      createdAt: "2024-01-10T09:15:00Z",
      processingTime: 2.3,
      modelVersion: "MIDAS-v2.1",
      doctorReview: {
        doctorId: "D001",
        doctorName: "Dr. Sarah Johnson",
        notes:
          "Asymmetric lesion with irregular borders. Multiple colors present. ABCDE criteria met. Recommend immediate biopsy.",
        recommendation: "Immediate Referral to Oncology",
        reviewedAt: "2024-01-10T15:30:00Z",
      },
    },
  ],
])

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const analysisId = params.id
    const analysis = mockAnalyses.get(analysisId)

    if (!analysis) {
      return NextResponse.json({ error: "Analysis not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      analysis,
    })
  } catch (error) {
    console.error("Get analysis error:", error)
    return NextResponse.json({ error: "Failed to retrieve analysis" }, { status: 500 })
  }
}
