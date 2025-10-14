import { type NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { randomUUID } from "crypto"
import { analyzeImage, checkBackendHealth, convertToFrontendFormat } from "@/lib/api-integration"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("image") as File

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Only JPEG and PNG are allowed." }, { status: 400 })
    }

    // Validate file size (50MB max)
    const maxSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File too large. Maximum size is 50MB." }, { status: 400 })
    }

    // Generate unique filename
    const analysisId = randomUUID()
    const fileExtension = file.name.split(".").pop()
    const fileName = `${analysisId}.${fileExtension}`

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), "uploads")
    try {
      await mkdir(uploadsDir, { recursive: true })
    } catch (error) {
      // Directory might already exist
    }

    // Save file
    const filePath = join(uploadsDir, fileName)
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Check if Python backend is available
    const isBackendAvailable = await checkBackendHealth()
    
    let analysisResult
    
    if (isBackendAvailable) {
      // Use Python ML backend for analysis
      const mlResult = await analyzeImage(file)
      
      if (mlResult && mlResult.success) {
        const converted = convertToFrontendFormat(mlResult)
        analysisResult = {
          analysisId,
          ...converted,
          imageMetadata: {
            originalName: file.name,
            size: file.size,
            type: file.type,
            uploadedAt: new Date().toISOString(),
          },
        }
      } else {
        throw new Error("ML analysis failed")
      }
    } else {
      // Fallback to mock result if backend is not available
      analysisResult = {
        analysisId,
        predictions: {
          Melanoma: 0.87,
          "Benign Nevus": 0.08,
          "Dysplastic Nevus": 0.05,
        },
        primaryPrediction: "Melanoma",
        confidence: 87,
        riskLevel: "high",
        processingTime: 2.3,
        imageMetadata: {
          originalName: file.name,
          size: file.size,
          type: file.type,
          uploadedAt: new Date().toISOString(),
        },
      }
    }

    return NextResponse.json({
      success: true,
      analysis: analysisResult,
      backend_status: isBackendAvailable ? 'connected' : 'mock_mode'
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Failed to process upload" }, { status: 500 })
  }
}
