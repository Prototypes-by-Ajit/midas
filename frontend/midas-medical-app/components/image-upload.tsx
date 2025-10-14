"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ImageUploadProps {
  onUploadComplete?: (analysisId: string) => void
}

export function ImageUpload({ onUploadComplete }: ImageUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileUpload(files[0])
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      handleFileUpload(files[0])
    }
  }, [])

  const handleFileUpload = async (file: File) => {
    setError(null)
    setUploading(true)
    setUploadProgress(0)

    try {
      // Validate file
      const allowedTypes = ["image/jpeg", "image/png", "image/jpg"]
      if (!allowedTypes.includes(file.type)) {
        throw new Error("Invalid file type. Only JPEG and PNG are allowed.")
      }

      const maxSize = 50 * 1024 * 1024 // 50MB
      if (file.size > maxSize) {
        throw new Error("File too large. Maximum size is 50MB.")
      }

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 200)

      // Upload file
      const formData = new FormData()
      formData.append("image", file)

      const response = await fetch("/api/analysis/upload", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Upload failed")
      }

      setUploadProgress(100)

      // Redirect to analysis results
      if (data.analysis?.analysisId) {
        setTimeout(() => {
          router.push(`/analysis/${data.analysis.analysisId}`)
          onUploadComplete?.(data.analysis.analysisId)
        }, 500)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
      setTimeout(() => setUploadProgress(0), 1000)
    }
  }

  if (uploading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Processing Your Image</CardTitle>
          <CardDescription>AI analysis in progress...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <Progress value={uploadProgress} className="h-2" />
            </div>
            <span className="text-sm font-medium">{uploadProgress}%</span>
          </div>
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">
              {uploadProgress < 30 && "Uploading image..."}
              {uploadProgress >= 30 && uploadProgress < 70 && "Preprocessing image..."}
              {uploadProgress >= 70 && uploadProgress < 90 && "Running AI analysis..."}
              {uploadProgress >= 90 && "Generating report..."}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Skin Check</CardTitle>
        <CardDescription>Upload an image for immediate AI analysis</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert className="mb-4 border-destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <div>
              <p className="text-lg font-medium text-foreground mb-2">Drag & drop image or click to browse</p>
              <p className="text-sm text-muted-foreground mb-4">
                Supports JPEG, PNG up to 50MB. Minimum 224x224 pixels recommended.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/jpeg,image/png,image/jpg"
                    onChange={handleFileSelect}
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    Upload Image
                  </label>
                </Button>
                <Button variant="outline">Take Photo</Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
