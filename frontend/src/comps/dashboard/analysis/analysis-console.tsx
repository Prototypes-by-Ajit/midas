"use client"



import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useLoading } from "@/contexts/loading-context"
import { useRole } from "@/contexts/role-context"
import Image from "next/image"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  IconUpload,
  IconScanEye,
  IconX,
  IconCheck,
  IconAlertTriangle,
  IconLoader,
  IconDownload,
  IconEye,
  IconChartBar,
  IconTargetArrow,
  IconPhoto
} from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import dynamic from "next/dynamic"
import { SAMPLE_IMAGES } from "@/data/dashboard/analysis"
import type { AnalysisResult } from "@/types/dashboard"

// recharts is lazy-loaded: ~100 kB that is only needed once an analysis result
// exists. Fallbacks reserve each chart's exact height so nothing shifts.
const chartFallback = (height: number) => {
  const Fallback = () => <div style={{ height }} aria-hidden />
  Fallback.displayName = "ChartFallback"
  return Fallback
}

const ConfidenceDonut = dynamic(
  () => import("@/comps/dashboard/analysis/analysis-charts").then((m) => m.ConfidenceDonut),
  { ssr: false, loading: chartFallback(200) }
)
const MetricsBar = dynamic(
  () => import("@/comps/dashboard/analysis/analysis-charts").then((m) => m.MetricsBar),
  { ssr: false, loading: chartFallback(300) }
)

export default function AnalysisConsole() {
  const { setLoadingState } = useLoading()
  const router = useRouter()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const userRole = useRole()
  const [showSampleImages, setShowSampleImages] = useState(false)
  const [heatmapIntensity, setHeatmapIntensity] = useState(50)

  const handleFileSelect = useCallback((file: File) => {
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file)
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      setShowSampleImages(false)
    }
  }, [])

  const handleSampleImageSelect = useCallback(async (imageUrl: string, imageName: string) => {
    try {
      // Fetch the image from URL
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const file = new File([blob], imageName, { type: blob.type })

      setSelectedFile(file)
      setPreviewUrl(imageUrl)
      setShowSampleImages(false)
    } catch (error) {
      console.error('Failed to load sample image:', error)
      alert('Failed to load sample image. Please try another one.')
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }, [handleFileSelect])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const clearFile = () => {
    setSelectedFile(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    setAnalysisResult(null)
    setHeatmapIntensity(50)
  }

  const runAnalysis = async () => {
    if (!selectedFile) return

    setIsAnalyzing(true)
    setLoadingState(true, "Analyzing image with AI...")

    try {
      const formData = new FormData()
      formData.append('image', selectedFile)

      const response = await fetch('/api/analysis/analyze', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        let errorMessage = `Analysis failed with status ${response.status}`
        let errorData: any = {}
        
        try {
          errorData = await response.json()
          console.error('Analysis API error response:', {
            status: response.status,
            statusText: response.statusText,
            data: errorData
          })
          
          errorMessage = errorData.details
            ? `${errorData.error || 'Error'}: ${errorData.details}`
            : errorData.error || errorMessage
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError)
          const textError = await response.text().catch(() => '')
          if (textError) {
            console.error('Error response text:', textError)
            errorMessage = textError
          }
        }
        
        throw new Error(errorMessage)
      }

      const data = await response.json()

      if (!data.success || !data.analysis) {
        throw new Error('Invalid response from server')
      }

      const result: AnalysisResult = {
        confidence: data.analysis.confidence,
        diagnosis: data.analysis.diagnosis,
        risk_level: data.analysis.risk_level,
        recommendations: data.analysis.recommendations,
        detected_features: data.analysis.detected_features,
        heatmap_url: data.analysis.heatmap_url ?? null,
        classification_metrics: data.analysis.classification_metrics ?? null,
        class_probabilities: data.analysis.class_probabilities ?? null,
        processing_time: data.analysis.processing_time
      }

      setAnalysisResult(result)
      // The history and reports pages now own this data server-side, so re-run
      // their Server Components rather than refetching into a client context.
      router.refresh()

    } catch (error) {
      console.error('Analysis error:', error)
      alert(error instanceof Error ? error.message : 'Failed to analyze image. Please try again.')
    } finally {
      setIsAnalyzing(false)
      setLoadingState(false)
    }
  }

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "low": return "bg-success-subtle text-success"
      case "medium": return "bg-warning-subtle text-warning"
      case "high": return "bg-critical-subtle text-critical"
      default: return "bg-surface text-foreground dark:bg-surface"
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">AI Analysis</h1>
        <p className="text-muted-foreground">
          Upload skin lesion images for AI-powered analysis and diagnosis
        </p>
      </div>

      {/* Sample Images Section (Patients Only) */}
      {userRole === 'patient' && !selectedFile && (
        <Card className="bg-background border border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <IconPhoto className="h-5 w-5" />
              Try Sample Images
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Test the AI analysis with these sample medical images
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {SAMPLE_IMAGES.map((sample) => (
                <button
                  key={sample.id}
                  onClick={() => handleSampleImageSelect(sample.url, sample.name)}
                  className="group relative overflow-hidden rounded-lg border-2 border-border hover:border-primary/25 dark:hover:border-primary/25 transition-all"
                >
                  <div className="relative h-48 w-full">
                    <Image
                      src={sample.url}
                      alt={sample.name}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white font-semibold">Click to Analyze</span>
                    </div>
                  </div>
                  <div className="p-3 bg-card">
                    <h4 className="font-semibold text-foreground text-sm">{sample.name}</h4>
                    <p className="text-xs text-muted-foreground">{sample.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Section */}
      <Card className="bg-background border border-border max-w-2xl mx-auto relative overflow-hidden w-full">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <IconUpload className="h-5 w-5" />
            Image Upload & Analysis
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Upload a high-quality image of the skin lesion for AI-powered analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedFile ? (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragOver
                  ? "border-primary/25 bg-primary-subtle"
                  : "border-border hover:border-border dark:hover:border-border"
              }`}
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragOver(true)
              }}
              onDragLeave={() => setIsDragOver(false)}
            >
              <IconUpload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium text-foreground mb-2">
                Drop image here or click to upload
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Supports JPG, PNG, JPEG up to 10MB
              </p>
              <Input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <Label htmlFor="file-upload">
                <Button asChild className="bg-background text-white hover:bg-surface dark:bg-card dark:text-foreground">
                  <span>Choose File</span>
                </Button>
              </Label>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <Image
                  src={previewUrl!}
                  alt="Selected lesion"
                  width={600}
                  height={400}
                  className="w-full h-96 object-cover rounded-lg border border-border"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFile}
                  className="absolute top-2 right-2 bg-background/50 text-white hover:bg-background/70"
                >
                  <IconX className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <IconCheck className="h-4 w-4 text-success" />
                <span>{selectedFile.name}</span>
                <span>({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
              </div>

              <Button
                onClick={runAnalysis}
                disabled={!selectedFile || isAnalyzing}
                className="w-full bg-background text-white hover:bg-surface dark:bg-card dark:text-foreground"
                size="lg"
              >
                {isAnalyzing ? (
                  <>
                    <IconLoader className="h-5 w-5 mr-2 animate-spin" />
                    Analyzing Image...
                  </>
                ) : (
                  <>
                    <IconScanEye className="h-5 w-5 mr-2" />
                    Start AI Analysis
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {analysisResult && (() => {
        const classProbabilities = analysisResult.class_probabilities ?? {}
        const probabilityData = Object.entries(classProbabilities)
          .map(([label, value]) => ({ label, value }))
          .sort((a, b) => b.value - a.value)

        const confidenceMetric = analysisResult.classification_metrics?.confidence ?? analysisResult.confidence
        const top2GapMetric = analysisResult.classification_metrics?.top2_gap
          ?? Math.max(confidenceMetric - (probabilityData[1]?.value ?? 0), 0)
        const entropyMetric = analysisResult.classification_metrics?.entropy ?? 0
        const maxEntropy = probabilityData.length > 1 ? Math.log(probabilityData.length) : 0
        const normalizedEntropy = maxEntropy > 0 ? Math.min(entropyMetric / maxEntropy, 1) : 0
        const certaintyMetric = 1 - normalizedEntropy

        const patientMetrics = [
          { name: "Confidence", value: analysisResult.confidence * 100 },
          { name: "Certainty", value: certaintyMetric * 100 },
        ]

        const clinicianMetrics = [
          { name: "Confidence", value: confidenceMetric * 100 },
          { name: "Top-2 Gap", value: top2GapMetric * 100 },
          { name: "Certainty", value: certaintyMetric * 100 },
        ]

        const confidenceData = [
          { name: "Confidence", value: analysisResult.confidence * 100, color: "#10b981" },
          { name: "Uncertainty", value: (1 - analysisResult.confidence) * 100, color: "#6b7280" },
        ]

        const heatmapFilter = userRole === 'clinician'
          ? `contrast(${(0.8 + (heatmapIntensity / 100) * 0.8).toFixed(2)}) saturate(${(0.8 + (heatmapIntensity / 100) * 1.4).toFixed(2)}) brightness(${(0.9 + (heatmapIntensity / 100) * 0.4).toFixed(2)})`
          : "none"

        return (
        <>
          <Card className="bg-background border border-border relative overflow-hidden">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <IconCheck className="h-5 w-5 text-success" />
                Analysis Results
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                AI-powered diagnosis and recommendations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Diagnosis Summary */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">Diagnosis</h3>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl font-bold text-foreground">
                        {analysisResult.diagnosis}
                      </span>
                      <Badge className={getRiskColor(analysisResult.risk_level)}>
                        {analysisResult.risk_level.toUpperCase()} RISK
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Confidence:</span>
                      <span className="font-semibold text-foreground">
                        {(analysisResult.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Confidence Pie Chart */}
                  <div>
                    <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                      <IconTargetArrow className="h-4 w-4" />
                      Confidence Level
                    </h4>
                    <ConfidenceDonut data={confidenceData} />
                    <div className="text-center">
                      <p className="text-2xl sm:text-3xl font-bold text-foreground">
                        {(analysisResult.confidence * 100).toFixed(1)}%
                      </p>
                      <p className="text-sm text-muted-foreground">Analysis Confidence</p>
                    </div>
                  </div>
                </div>

                {/* Class probabilities — the model's actual output distribution.
                    Replaces an "ABCDE Feature Analysis" radar whose five scores
                    were a ternary on risk_level; nothing in the pipeline measures
                    asymmetry, border, colour, diameter or evolution. */}
                <div>
                  <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <IconChartBar className="h-4 w-4" />
                    Class probabilities
                  </h4>
                  {probabilityData.length > 0 ? (
                    <div className="space-y-3">
                      {probabilityData.map((entry) => (
                        <div key={entry.label} className="space-y-1">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="uppercase tracking-wide">{entry.label}</span>
                            <span>{(entry.value * 100).toFixed(1)}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-gray-200 dark:bg-surface">
                            <div
                              className="h-2 rounded-full bg-primary"
                              style={{ width: `${Math.min(entry.value * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No probability distribution was returned for this analysis.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Heatmap Visualization */}
          <Card className="bg-background border border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <IconScanEye className="h-5 w-5" />
                Heatmap Visualization
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Highlighted regions used by the model during inference
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analysisResult.heatmap_url ? (
                <div className="space-y-4">
                  <div className="relative overflow-hidden rounded-lg border border-border">
                    <img
                      src={analysisResult.heatmap_url}
                      alt="AI heatmap overlay"
                      className="w-full h-96 object-contain bg-surface"
                      style={{ filter: heatmapFilter }}
                    />
                  </div>
                  {userRole === 'clinician' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-foreground">Heatmap temperature</span>
                        <span className="text-muted-foreground">{heatmapIntensity}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={heatmapIntensity}
                        onChange={(event) => setHeatmapIntensity(Number(event.target.value))}
                        className="w-full accent-black dark:accent-white"
                        aria-label="Heatmap temperature control"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Heatmap not available yet for this analysis.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Recommendations. The "Detected Features" card that used to sit
              beside this one listed morphological findings the pipeline never
              measured — they were selected by an if-statement on the predicted
              class. See backend/app/api/image_analysis.py. */}
          <div className="grid gap-6">
            <Card className="bg-background border border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {analysisResult.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <IconAlertTriangle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-foreground">{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Role-Based Metrics */}
          <Card className="bg-background border border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <IconChartBar className="h-5 w-5" />
                {userRole === 'clinician' || userRole === 'admin' ? 'Classification Metrics' : 'Performance Metrics'}
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                {userRole === 'clinician' || userRole === 'admin'
                  ? 'Comprehensive model performance metrics for clinical evaluation'
                  : 'Model confidence and accuracy scores'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {userRole === 'clinician' || userRole === 'admin' ? (
                <>
                  {/* Clinician View - Detailed Metrics */}
                  <MetricsBar data={clinicianMetrics} height={300} fill="#3b82f6" />
                </>
              ) : (
                /* Patient View - Simple Metrics */
                <MetricsBar data={patientMetrics} height={250} cellFills={["#3b82f6", "#10b981"]} />
              )}

            </CardContent>
          </Card>

          {/* Action Buttons */}
          <Card className="bg-background border border-border">
            <CardContent className="p-6">
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" className="border-black text-foreground hover:bg-background hover:text-white dark:hover:bg-card dark:hover:text-foreground">
                  <IconDownload className="h-4 w-4 mr-2" />
                  Export Report
                </Button>
                <Button variant="outline" className="border-black text-foreground hover:bg-background hover:text-white dark:hover:bg-card dark:hover:text-foreground">
                  <IconEye className="h-4 w-4 mr-2" />
                  View Detailed Analysis
                </Button>
                <Button
                  onClick={clearFile}
                  className="bg-background text-white hover:bg-surface dark:bg-card dark:text-foreground"
                >
                  New Analysis
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
        )
      })()}
    </div>
  )
}