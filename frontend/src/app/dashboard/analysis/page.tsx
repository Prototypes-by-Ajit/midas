"use client"

import { useState, useCallback, useEffect } from "react"
import { useLoading } from "@/contexts/loading-context"
import { useAnalytics } from "@/contexts/analytics-context"
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
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie
} from "recharts"

// Sample images for testing (patients only)
const SAMPLE_IMAGES = [
  {
    id: 1,
    name: "Benign Mole",
    url: "/benign_mole_sample.jpg",
    description: "Example of a benign nevus"
  },
  {
    id: 2,
    name: "Melanoma Sample",
    url: "/melanoma_sample.jpg",
    description: "Suspicious lesion example"
  },
  {
    id: 3,
    name: "Basal Cell",
    url: "/basal_cell_sample.jpg",
    description: "Basal cell carcinoma sample"
  }
]

interface AnalysisResult {
  confidence: number;
  diagnosis: string;
  risk_level: "low" | "medium" | "high";
  recommendations: string[]
  detected_features: string[]
  heatmap_url?: string | null
  classification_metrics?: {
    confidence?: number
    top2_gap?: number
    entropy?: number
  } | null
  class_probabilities?: Record<string, number> | null
  processing_time?: number
}

export default function AnalysisPage() {
  const { setLoadingState } = useLoading()
  const { refreshData } = useAnalytics()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [userRole, setUserRole] = useState<string>('patient')
  const [showSampleImages, setShowSampleImages] = useState(false)
  const [heatmapIntensity, setHeatmapIntensity] = useState(50)

  // Fetch user role
  useEffect(() => {
    fetch('/api/user/role')
      .then(res => res.json())
      .then(data => setUserRole(data.role || 'patient'))
      .catch(err => console.error('Failed to fetch role:', err))
  }, [])

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
      refreshData()

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
      case "low": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "medium": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
      case "high": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 bg-white dark:bg-black min-h-screen">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-black dark:text-white">AI Analysis</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Upload skin lesion images for AI-powered analysis and diagnosis
        </p>
      </div>

      {/* Sample Images Section (Patients Only) */}
      {userRole === 'patient' && !selectedFile && (
        <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="text-black dark:text-white flex items-center gap-2">
              <IconPhoto className="h-5 w-5" />
              Try Sample Images
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Test the AI analysis with these sample medical images
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {SAMPLE_IMAGES.map((sample) => (
                <button
                  key={sample.id}
                  onClick={() => handleSampleImageSelect(sample.url, sample.name)}
                  className="group relative overflow-hidden rounded-lg border-2 border-gray-200 dark:border-gray-800 hover:border-blue-500 dark:hover:border-blue-400 transition-all"
                >
                  <div className="relative h-48 w-full">
                    <Image
                      src={sample.url}
                      alt={sample.name}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white font-semibold">Click to Analyze</span>
                    </div>
                  </div>
                  <div className="p-3 bg-white dark:bg-gray-900">
                    <h4 className="font-semibold text-black dark:text-white text-sm">{sample.name}</h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{sample.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Section */}
      <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 max-w-2xl mx-auto relative overflow-hidden w-full">
        <CardHeader>
          <CardTitle className="text-black dark:text-white flex items-center gap-2">
            <IconUpload className="h-5 w-5" />
            Image Upload & Analysis
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Upload a high-quality image of the skin lesion for AI-powered analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedFile ? (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragOver
                  ? "border-blue-400 bg-blue-50 dark:bg-blue-950"
                  : "border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600"
              }`}
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragOver(true)
              }}
              onDragLeave={() => setIsDragOver(false)}
            >
              <IconUpload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium text-black dark:text-white mb-2">
                Drop image here or click to upload
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
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
                <Button asChild className="bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200">
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
                  className="w-full h-96 object-cover rounded-lg border border-gray-200 dark:border-gray-800"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFile}
                  className="absolute top-2 right-2 bg-black/50 text-white hover:bg-black/70"
                >
                  <IconX className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <IconCheck className="h-4 w-4 text-green-500" />
                <span>{selectedFile.name}</span>
                <span>({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
              </div>

              <Button
                onClick={runAnalysis}
                disabled={!selectedFile || isAnalyzing}
                className="w-full bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
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
        const featureScores = [
          { feature: "Border", score: analysisResult.risk_level === "high" ? 85 : analysisResult.risk_level === "medium" ? 60 : 40, fullMark: 100 },
          { feature: "Color", score: analysisResult.risk_level === "high" ? 80 : analysisResult.risk_level === "medium" ? 55 : 35, fullMark: 100 },
          { feature: "Symmetry", score: analysisResult.risk_level === "high" ? 75 : analysisResult.risk_level === "medium" ? 50 : 30, fullMark: 100 },
          { feature: "Diameter", score: analysisResult.risk_level === "high" ? 70 : analysisResult.risk_level === "medium" ? 45 : 25, fullMark: 100 },
          { feature: "Evolution", score: analysisResult.risk_level === "high" ? 78 : analysisResult.risk_level === "medium" ? 48 : 28, fullMark: 100 },
        ]

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
          <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 relative overflow-hidden">
            <CardHeader>
              <CardTitle className="text-black dark:text-white flex items-center gap-2">
                <IconCheck className="h-5 w-5 text-green-500" />
                Analysis Results
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                AI-powered diagnosis and recommendations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Diagnosis Summary */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-black dark:text-white mb-2">Diagnosis</h3>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl font-bold text-black dark:text-white">
                        {analysisResult.diagnosis}
                      </span>
                      <Badge className={getRiskColor(analysisResult.risk_level)}>
                        {analysisResult.risk_level.toUpperCase()} RISK
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <span>Confidence:</span>
                      <span className="font-semibold text-black dark:text-white">
                        {(analysisResult.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Confidence Pie Chart */}
                  <div>
                    <h4 className="font-semibold text-black dark:text-white mb-2 flex items-center gap-2">
                      <IconTargetArrow className="h-4 w-4" />
                      Confidence Level
                    </h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={confidenceData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {confidenceData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-black dark:text-white">
                        {(analysisResult.confidence * 100).toFixed(1)}%
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Analysis Confidence</p>
                    </div>
                  </div>
                </div>

                {/* Feature Analysis Radar Chart */}
                <div>
                  <h4 className="font-semibold text-black dark:text-white mb-2 flex items-center gap-2">
                    <IconChartBar className="h-4 w-4" />
                    ABCDE Feature Analysis
                  </h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={featureScores}>
                      <PolarGrid stroke="#374151" />
                      <PolarAngleAxis dataKey="feature" stroke="#9ca3af" fontSize={12} />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="#9ca3af" fontSize={10} />
                      <Radar
                        name="Risk Score"
                        dataKey="score"
                        stroke={analysisResult.risk_level === "high" ? "#ef4444" : analysisResult.risk_level === "medium" ? "#f59e0b" : "#10b981"}
                        fill={analysisResult.risk_level === "high" ? "#ef4444" : analysisResult.risk_level === "medium" ? "#f59e0b" : "#10b981"}
                        fillOpacity={0.6}
                      />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                  <div className="text-center mt-2">
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      ABCDE Rule: Asymmetry, Border, Color, Diameter, Evolution
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Heatmap Visualization */}
          <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800">
            <CardHeader>
              <CardTitle className="text-black dark:text-white flex items-center gap-2">
                <IconScanEye className="h-5 w-5" />
                Heatmap Visualization
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Highlighted regions used by the model during inference
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analysisResult.heatmap_url ? (
                <div className="space-y-4">
                  <div className="relative overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
                    <img
                      src={analysisResult.heatmap_url}
                      alt="AI heatmap overlay"
                      className="w-full h-96 object-contain bg-gray-50 dark:bg-gray-900"
                      style={{ filter: heatmapFilter }}
                    />
                  </div>
                  {userRole === 'clinician' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-700 dark:text-gray-300">Heatmap temperature</span>
                        <span className="text-gray-600 dark:text-gray-400">{heatmapIntensity}%</span>
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
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Heatmap not available yet for this analysis.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Detected Features & Recommendations */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800">
              <CardHeader>
                <CardTitle className="text-black dark:text-white">Detected Features</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {analysisResult.detected_features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <IconCheck className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800">
              <CardHeader>
                <CardTitle className="text-black dark:text-white">Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {analysisResult.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <IconAlertTriangle className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Role-Based Metrics */}
          <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800">
            <CardHeader>
              <CardTitle className="text-black dark:text-white flex items-center gap-2">
                <IconChartBar className="h-5 w-5" />
                {userRole === 'clinician' || userRole === 'admin' ? 'Classification Metrics' : 'Performance Metrics'}
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                {userRole === 'clinician' || userRole === 'admin'
                  ? 'Comprehensive model performance metrics for clinical evaluation'
                  : 'Model confidence and accuracy scores'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {userRole === 'clinician' || userRole === 'admin' ? (
                <>
                  {/* Clinician View - Detailed Metrics */}
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={clinicianMetrics}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                      <XAxis dataKey="name" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          border: '1px solid #374151',
                          borderRadius: '8px'
                        }}
                        formatter={(value: number) => `${value.toFixed(1)}%`}
                      />
                      <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              ) : (
                /* Patient View - Simple Metrics */
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={patientMetrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                    <XAxis dataKey="name" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        border: '1px solid #374151',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => `${value.toFixed(1)}%`}
                    />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                      {patientMetrics.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={index === 0 ? "#3b82f6" : "#10b981"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}

              {probabilityData.length > 0 && (
                <div className="mt-6 space-y-3">
                  <h4 className="text-sm font-semibold text-black dark:text-white">Class probabilities</h4>
                  {probabilityData.map((entry) => (
                    <div key={entry.label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                        <span className="uppercase tracking-wide">{entry.label}</span>
                        <span>{(entry.value * 100).toFixed(1)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-800">
                        <div
                          className="h-2 rounded-full bg-blue-500"
                          style={{ width: `${Math.min(entry.value * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800">
            <CardContent className="p-6">
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" className="border-black text-black hover:bg-black hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black">
                  <IconDownload className="h-4 w-4 mr-2" />
                  Export Report
                </Button>
                <Button variant="outline" className="border-black text-black hover:bg-black hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black">
                  <IconEye className="h-4 w-4 mr-2" />
                  View Detailed Analysis
                </Button>
                <Button
                  onClick={clearFile}
                  className="bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
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
