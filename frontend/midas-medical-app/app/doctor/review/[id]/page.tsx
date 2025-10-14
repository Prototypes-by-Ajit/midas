"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface PatientAnalysis {
  id: string
  patientId: string
  patientName: string
  age: number
  gender: string
  imageUrl: string
  predictions: Record<string, number>
  primaryPrediction: string
  confidence: number
  riskLevel: string
  submittedAt: string
  bodyLocation: string
  patientHistory: {
    previousScans: number
    lastScan: string
    riskFactors: string[]
  }
}

// Mock data for clinical review
const mockAnalysisData: Record<string, PatientAnalysis> = {
  AN2024005: {
    id: "AN2024005",
    patientId: "P001234",
    patientName: "John Smith",
    age: 45,
    gender: "M",
    imageUrl: "/placeholder.svg?height=400&width=400",
    predictions: {
      Melanoma: 0.87,
      "Benign Nevus": 0.08,
      "Dysplastic Nevus": 0.05,
    },
    primaryPrediction: "Melanoma",
    confidence: 87,
    riskLevel: "high",
    submittedAt: "2024-01-15T14:30:00Z",
    bodyLocation: "Back",
    patientHistory: {
      previousScans: 2,
      lastScan: "2023-12-15",
      riskFactors: ["Family history of melanoma", "Fair skin", "Multiple moles"],
    },
  },
}

export default function ClinicalReview() {
  const params = useParams()
  const router = useRouter()
  const [analysis, setAnalysis] = useState<PatientAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [agreeWithAI, setAgreeWithAI] = useState(true)
  const [clinicalNotes, setClinicalNotes] = useState("")
  const [diagnosis, setDiagnosis] = useState("")
  const [recommendation, setRecommendation] = useState("")
  const [followUpPeriod, setFollowUpPeriod] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // Simulate API call
    const fetchAnalysis = () => {
      const analysisData = mockAnalysisData[params.id as string]
      if (analysisData) {
        setAnalysis(analysisData)
        setDiagnosis(analysisData.primaryPrediction)
      }
      setLoading(false)
    }

    setTimeout(fetchAnalysis, 500)
  }, [params.id])

  const handleSaveReview = async () => {
    setSaving(true)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // TODO: Save review to backend
    console.log("Saving review:", {
      analysisId: params.id,
      agreeWithAI,
      clinicalNotes,
      diagnosis,
      recommendation,
      followUpPeriod,
    })

    setSaving(false)
    router.push("/doctor/dashboard")
  }

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case "high":
        return "text-destructive"
      case "moderate":
        return "text-orange-600"
      case "low":
        return "text-primary"
      default:
        return "text-muted-foreground"
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading patient analysis...</p>
        </div>
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Analysis Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">The requested analysis could not be found.</p>
            <Link href="/doctor/dashboard">
              <Button>Back to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/" className="flex items-center space-x-2">
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-sm">M</span>
                </div>
                <span className="text-xl font-bold text-foreground">MIDAS</span>
              </Link>
              <span className="text-muted-foreground">Clinical Review</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/doctor/dashboard">
                <Button variant="outline">Back to Dashboard</Button>
              </Link>
              <Button onClick={handleSaveReview} disabled={saving}>
                {saving ? "Saving..." : "Save Review"}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Patient Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Patient: {analysis.patientName}</h1>
              <p className="text-muted-foreground">
                ID: {analysis.patientId} | Age: {analysis.age} | Gender: {analysis.gender}
              </p>
            </div>
            <Badge
              className={
                analysis.riskLevel === "high"
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-primary text-primary-foreground"
              }
            >
              {analysis.riskLevel.toUpperCase()} RISK
            </Badge>
          </div>

          {analysis.riskLevel === "high" && (
            <Alert className="border-destructive">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
              <AlertDescription>
                <strong>High Risk Case:</strong> AI analysis suggests potential malignancy. Immediate attention
                required.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Image Analysis */}
          <div className="lg:col-span-2 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Original Image */}
              <Card>
                <CardHeader>
                  <CardTitle>Original Image</CardTitle>
                  <CardDescription>Location: {analysis.bodyLocation}</CardDescription>
                </CardHeader>
                <CardContent>
                  <img
                    src={analysis.imageUrl || "/placeholder.svg"}
                    alt="Skin lesion"
                    className="w-full h-64 object-cover rounded-lg border border-border"
                  />
                  <div className="mt-4 flex justify-center space-x-2">
                    <Button variant="outline" size="sm">
                      Zoom In
                    </Button>
                    <Button variant="outline" size="sm">
                      Enhance
                    </Button>
                    <Button variant="outline" size="sm">
                      Measure
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Enhanced/Filtered Image */}
              <Card>
                <CardHeader>
                  <CardTitle>Enhanced View</CardTitle>
                  <CardDescription>AI-enhanced visualization</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="w-full h-64 bg-muted rounded-lg border border-border flex items-center justify-center">
                    <p className="text-muted-foreground">Enhanced image would appear here</p>
                  </div>
                  <div className="mt-4 flex justify-center space-x-2">
                    <Button variant="outline" size="sm">
                      Dermoscopy
                    </Button>
                    <Button variant="outline" size="sm">
                      UV Filter
                    </Button>
                    <Button variant="outline" size="sm">
                      Contrast
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* AI Analysis Results */}
            <Card>
              <CardHeader>
                <CardTitle>AI Analysis Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Primary Prediction:</span>
                    <Badge className="bg-primary text-primary-foreground">{analysis.confidence}% confidence</Badge>
                  </div>
                  <p className={`text-xl font-bold ${getRiskColor(analysis.riskLevel)}`}>
                    {analysis.primaryPrediction}
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">All Predictions:</p>
                  {Object.entries(analysis.predictions)
                    .sort(([, a], [, b]) => b - a)
                    .map(([prediction, confidence]) => (
                      <div key={prediction} className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{prediction}</span>
                        <div className="flex items-center space-x-2">
                          <Progress value={confidence * 100} className="w-24 h-2" />
                          <span className="text-sm font-medium w-12">{Math.round(confidence * 100)}%</span>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Clinical Assessment */}
          <div className="space-y-6">
            {/* Patient History */}
            <Card>
              <CardHeader>
                <CardTitle>Patient History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Previous Scans:</span>
                  <span className="text-sm font-medium">{analysis.patientHistory.previousScans}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Last Scan:</span>
                  <span className="text-sm font-medium">{analysis.patientHistory.lastScan}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Risk Factors:</p>
                  <div className="space-y-1">
                    {analysis.patientHistory.riskFactors.map((factor, index) => (
                      <Badge key={index} variant="outline" className="text-xs mr-1 mb-1">
                        {factor}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Clinical Assessment Form */}
            <Card>
              <CardHeader>
                <CardTitle>Clinical Assessment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="agree-ai"
                    checked={agreeWithAI}
                    onCheckedChange={(checked) => setAgreeWithAI(checked as boolean)}
                  />
                  <Label htmlFor="agree-ai" className="text-sm">
                    Agree with AI diagnosis
                  </Label>
                </div>

                {!agreeWithAI && (
                  <div className="space-y-2">
                    <Label htmlFor="override-diagnosis">Override Diagnosis</Label>
                    <Select value={diagnosis} onValueChange={setDiagnosis}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select diagnosis" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Melanoma">Melanoma</SelectItem>
                        <SelectItem value="Basal Cell Carcinoma">Basal Cell Carcinoma</SelectItem>
                        <SelectItem value="Squamous Cell Carcinoma">Squamous Cell Carcinoma</SelectItem>
                        <SelectItem value="Actinic Keratosis">Actinic Keratosis</SelectItem>
                        <SelectItem value="Benign Keratosis">Benign Keratosis</SelectItem>
                        <SelectItem value="Dermatofibroma">Dermatofibroma</SelectItem>
                        <SelectItem value="Vascular Lesion">Vascular Lesion</SelectItem>
                        <SelectItem value="Benign Nevus">Benign Nevus</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="clinical-notes">Clinical Notes</Label>
                  <Textarea
                    id="clinical-notes"
                    placeholder="Enter your clinical observations, ABCDE criteria assessment, and diagnostic reasoning..."
                    value={clinicalNotes}
                    onChange={(e) => setClinicalNotes(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recommendation">Recommended Action</Label>
                  <Select value={recommendation} onValueChange={setRecommendation}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select recommendation" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediate-biopsy">Immediate Biopsy</SelectItem>
                      <SelectItem value="urgent-referral">Urgent Referral to Oncology</SelectItem>
                      <SelectItem value="routine-referral">Routine Referral</SelectItem>
                      <SelectItem value="monitor">Monitor - Follow-up</SelectItem>
                      <SelectItem value="reassurance">Patient Reassurance</SelectItem>
                      <SelectItem value="second-opinion">Request Second Opinion</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="follow-up">Follow-up Period</Label>
                  <Select value={followUpPeriod} onValueChange={setFollowUpPeriod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select follow-up period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1-week">1 Week</SelectItem>
                      <SelectItem value="2-weeks">2 Weeks</SelectItem>
                      <SelectItem value="1-month">1 Month</SelectItem>
                      <SelectItem value="3-months">3 Months</SelectItem>
                      <SelectItem value="6-months">6 Months</SelectItem>
                      <SelectItem value="1-year">1 Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button onClick={handleSaveReview} className="w-full" disabled={saving}>
                {saving ? "Saving Review..." : "Complete Review"}
              </Button>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="bg-transparent">
                  Request Second Opinion
                </Button>
                <Button variant="outline" className="bg-transparent">
                  Generate Report
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
