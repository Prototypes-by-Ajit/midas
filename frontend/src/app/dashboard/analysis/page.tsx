"use client"

import { useState, useCallback } from "react"
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
  IconTargetArrow
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

// const StripesBackground = dynamic(
//   () => import("@/components/lightswind/stripes-background").then((mod) => ({ default: mod.default })),
//   {
//     ssr: true,
//     loading: () => null,
//   }
// );

interface AnalysisResult {
  confidence: number;
  diagnosis: string;
  risk_level: "low" | "medium" | "high";
  recommendations: string[]
  detected_features: string[]
}

export default function AnalysisPage() {
  const { setLoadingState } = useLoading()
  const { addAnalysisResult } = useAnalytics()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleFileSelect = useCallback((file: File) => {
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file)
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
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
  }

  const runAnalysis = async () => {
    if (!selectedFile) return

    setIsAnalyzing(true)
    // Show LifeLine loading for analysis
    setLoadingState(true, "Analyzing image with AI...")
    
    const startTime = Date.now()
    
    // Simulate AI analysis - replace with actual API call later
    setTimeout(() => {
      const processingTime = Date.now() - startTime
      
      // Generate more realistic mock results based on image name or random factors
      const diagnoses = [
        { diagnosis: "Benign Nevus", risk_level: "low" as const, confidence: 0.92 + Math.random() * 0.07 },
        { diagnosis: "Seborrheic Keratosis", risk_level: "low" as const, confidence: 0.88 + Math.random() * 0.08 },
        { diagnosis: "Melanoma", risk_level: "high" as const, confidence: 0.75 + Math.random() * 0.15 },
        { diagnosis: "Basal Cell Carcinoma", risk_level: "medium" as const, confidence: 0.80 + Math.random() * 0.12 },
        { diagnosis: "Atypical Nevus", risk_level: "medium" as const, confidence: 0.70 + Math.random() * 0.20 }
      ]
      
      const randomResult = diagnoses[Math.floor(Math.random() * diagnoses.length)]
      
      const mockResult: AnalysisResult = {
        confidence: Math.round(randomResult.confidence * 1000) / 1000,
        diagnosis: randomResult.diagnosis,
        risk_level: randomResult.risk_level,
        recommendations: getRecommendationsForRisk(randomResult.risk_level),
        detected_features: getDetectedFeatures(randomResult.risk_level)
      }
      
      // Save to analytics context with additional metadata
      const analysisData = {
        ...mockResult,
        image_name: selectedFile.name,
        image_url: previewUrl || '',
        processing_time: processingTime
      }
      
      addAnalysisResult(analysisData)
      setAnalysisResult(mockResult)
      setIsAnalyzing(false)
      // Hide LifeLine loading when analysis is done
      setLoadingState(false)
    }, 3000)
  }
  
  const getRecommendationsForRisk = (riskLevel: "low" | "medium" | "high"): string[] => {
    switch (riskLevel) {
      case "low":
        return [
          "Continue regular skin monitoring",
          "Schedule follow-up in 6-12 months",
          "Apply SPF 30+ sunscreen daily",
          "Perform monthly self-examinations"
        ]
      case "medium":
        return [
          "Schedule dermatologist consultation within 3 months",
          "Monitor for any changes in size, color, or texture",
          "Apply SPF 30+ sunscreen daily",
          "Take photos for comparison tracking",
          "Avoid excessive sun exposure"
        ]
      case "high":
        return [
          "URGENT: Schedule immediate dermatologist consultation",
          "Consider biopsy evaluation",
          "Document any recent changes",
          "Avoid sun exposure to the area",
          "Do not delay seeking professional medical advice"
        ]
    }
  }
  
  const getDetectedFeatures = (riskLevel: "low" | "medium" | "high"): string[] => {
    const commonFeatures = [
      "Border analysis completed",
      "Color distribution assessed",
      "Symmetry evaluation performed",
      "Diameter measurements taken"
    ]
    
    switch (riskLevel) {
      case "low":
        return [
          ...commonFeatures,
          "Regular, well-defined borders",
          "Uniform color pattern",
          "Symmetrical structure"
        ]
      case "medium":
        return [
          ...commonFeatures,
          "Some irregular features detected",
          "Color variation observed",
          "Asymmetrical characteristics present"
        ]
      case "high":
        return [
          ...commonFeatures,
          "Irregular borders identified",
          "Multiple color variations",
          "Asymmetrical pattern detected",
          "Unusual texture characteristics"
        ]
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
      {/* <div className="absolute inset-0 z-0">
      <StripesBackground
        position="full"
  width="w-full"
  height="h-full"
  opacity="opacity-60"
/>
      </div> */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-black dark:text-white">AI Analysis</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Upload skin lesion images for AI-powered analysis and diagnosis
        </p>
      </div>

      {/* Upload Section */}
      <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 max-w-2xl mx-auto relative overflow-hidden">
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
              
              {/* Analysis Button */}
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
        // Prepare chart data
        const featureScores = [
          { feature: "Border", score: analysisResult.risk_level === "high" ? 85 : analysisResult.risk_level === "medium" ? 60 : 40, fullMark: 100 },
          { feature: "Color", score: analysisResult.risk_level === "high" ? 80 : analysisResult.risk_level === "medium" ? 55 : 35, fullMark: 100 },
          { feature: "Symmetry", score: analysisResult.risk_level === "high" ? 75 : analysisResult.risk_level === "medium" ? 50 : 30, fullMark: 100 },
          { feature: "Diameter", score: analysisResult.risk_level === "high" ? 70 : analysisResult.risk_level === "medium" ? 45 : 25, fullMark: 100 },
          { feature: "Evolution", score: analysisResult.risk_level === "high" ? 78 : analysisResult.risk_level === "medium" ? 48 : 28, fullMark: 100 },
        ]

        const riskMetrics = [
          { name: "Current Risk", value: analysisResult.risk_level === "high" ? 85 : analysisResult.risk_level === "medium" ? 50 : 20 },
          { name: "Confidence", value: analysisResult.confidence * 100 },
        ]

        const confidenceData = [
          { name: "Confidence", value: analysisResult.confidence * 100, color: "#10b981" },
          { name: "Uncertainty", value: (1 - analysisResult.confidence) * 100, color: "#6b7280" },
        ]

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

          {/* Detected Features & Recommendations */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Detected Features */}
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

            {/* Recommendations */}
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

          {/* Risk Metrics Bar Chart */}
          <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800">
            <CardHeader>
              <CardTitle className="text-black dark:text-white flex items-center gap-2">
                <IconChartBar className="h-5 w-5" />
                Risk Assessment Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={riskMetrics}>
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
                    {riskMetrics.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={index === 0 ? 
                          (analysisResult.risk_level === "high" ? "#ef4444" : 
                           analysisResult.risk_level === "medium" ? "#f59e0b" : "#10b981") 
                          : "#3b82f6"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
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