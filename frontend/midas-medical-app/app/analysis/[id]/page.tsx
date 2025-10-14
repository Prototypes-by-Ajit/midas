"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Analysis {
  id: string
  patientId: string
  imageUrl: string
  predictions: Record<string, number>
  primaryPrediction: string
  confidence: number
  riskLevel: string
  status: string
  createdAt: string
  processingTime: number
  modelVersion: string
  doctorReview?: {
    doctorId: string
    doctorName: string
    notes: string
    recommendation: string
    reviewedAt: string
  }
}

export default function AnalysisResultPage() {
  const params = useParams()
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        const response = await fetch(`/api/analysis/${params.id}`)
        const data = await response.json()

        if (data.success) {
          setAnalysis(data.analysis)
        } else {
          setError(data.error || "Failed to load analysis")
        }
      } catch (err) {
        setError("Failed to load analysis")
      } finally {
        setLoading(false)
      }
    }

    if (params.id) {
      fetchAnalysis()
    }
  }, [params.id])

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

  const getRiskBadgeColor = (riskLevel: string) => {
    switch (riskLevel) {
      case "high":
        return "bg-destructive text-destructive-foreground"
      case "moderate":
        return "bg-orange-100 text-orange-800"
      case "low":
        return "bg-primary text-primary-foreground"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading analysis results...</p>
        </div>
      </div>
    )
  }

  if (error || !analysis) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Link href="/dashboard">
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
              <span className="text-muted-foreground">Analysis Results</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/dashboard">
                <Button variant="outline">Back to Dashboard</Button>
              </Link>
              <Button>Export Report</Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-foreground">Analysis Results</h1>
            <Badge className={getRiskBadgeColor(analysis.riskLevel)}>{analysis.riskLevel.toUpperCase()} RISK</Badge>
          </div>
          <p className="text-muted-foreground">Analysis ID: {analysis.id}</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Image and Visualization */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Original Image</CardTitle>
              </CardHeader>
              <CardContent>
                <img
                  src={analysis.imageUrl || "/placeholder.svg?height=400&width=400"}
                  alt="Skin lesion analysis"
                  className="w-full h-80 object-cover rounded-lg border border-border"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Heatmap Overlay</CardTitle>
                <CardDescription>Areas of interest highlighted by AI</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="w-full h-80 bg-muted rounded-lg border border-border flex items-center justify-center">
                  <p className="text-muted-foreground">Heatmap visualization would appear here</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Analysis Results */}
          <div className="space-y-6">
            {/* Primary Result */}
            <Card>
              <CardHeader>
                <CardTitle>Classification Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Primary Prediction:</span>
                    <Badge className={getRiskBadgeColor(analysis.riskLevel)}>{analysis.confidence}% confidence</Badge>
                  </div>
                  <p className={`text-2xl font-bold ${getRiskColor(analysis.riskLevel)}`}>
                    {analysis.primaryPrediction}
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">Other Possibilities:</p>
                  {Object.entries(analysis.predictions)
                    .filter(([key]) => key !== analysis.primaryPrediction)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 3)
                    .map(([prediction, confidence]) => (
                      <div key={prediction} className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{prediction}</span>
                        <div className="flex items-center space-x-2">
                          <Progress value={confidence * 100} className="w-20 h-2" />
                          <span className="text-sm font-medium w-12">{Math.round(confidence * 100)}%</span>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Risk Assessment */}
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
                  <strong>Important Notice:</strong> This analysis suggests potential{" "}
                  {analysis.primaryPrediction.toLowerCase()}. Immediate consultation with a dermatologist is strongly
                  recommended.
                </AlertDescription>
              </Alert>
            )}

            {/* Doctor Review */}
            {analysis.doctorReview && (
              <Card>
                <CardHeader>
                  <CardTitle>Doctor Review</CardTitle>
                  <CardDescription>
                    Reviewed by {analysis.doctorReview.doctorName} on{" "}
                    {new Date(analysis.doctorReview.reviewedAt).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">Clinical Notes:</p>
                    <p className="text-sm text-muted-foreground">{analysis.doctorReview.notes}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">Recommendation:</p>
                    <Badge variant="outline">{analysis.doctorReview.recommendation}</Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Analysis Details */}
            <Card>
              <CardHeader>
                <CardTitle>Analysis Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Analysis Date:</span>
                  <span className="text-sm font-medium">{new Date(analysis.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Processing Time:</span>
                  <span className="text-sm font-medium">{analysis.processingTime} seconds</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Model Version:</span>
                  <span className="text-sm font-medium">{analysis.modelVersion}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <Badge variant="outline">{analysis.status}</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex flex-col space-y-3">
              <Button className="w-full">Download Full Report PDF</Button>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline">Book Appointment</Button>
                <Button variant="outline">Share with Doctor</Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
