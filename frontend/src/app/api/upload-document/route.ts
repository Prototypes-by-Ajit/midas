import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createClient } from "@supabase/supabase-js"

const getSupabaseAdmin = () => {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

  if (!url || !key) {
    throw new Error("Supabase credentials not configured")
  }

  return createClient(url, key, { auth: { persistSession: false } })
}

export async function POST(req: Request) {
  try {
    console.log("[API] POST /api/upload-document called")

    const { userId } = await auth()
    console.log("[API] User ID from auth:", userId)

    if (!userId) {
      console.error("[API] Upload failed: User not authenticated")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse multipart form data
    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    console.log("[API] File received:", {
      name: file.name,
      type: file.type,
      size: file.size
    })

    // Validate file type
    const allowedTypes = ["text/plain", "application/pdf"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only .txt and .pdf files are allowed." },
        { status: 400 }
      )
    }

    // Initialize Supabase
    const supabase = getSupabaseAdmin()

    // Generate unique file path
    const timestamp = Date.now()
    const fileExt = file.name.split(".").pop()
    const storagePath = `documents/${userId}/${timestamp}_${file.name}`

    console.log("[API] Uploading to storage:", storagePath)

    // Upload file to Supabase Storage
    const fileBuffer = await file.arrayBuffer()
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("Multiagent_Skincancer_RAG")
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      console.error("[API] Storage upload error:", uploadError)
      return NextResponse.json(
        { error: "Failed to upload file", details: uploadError.message },
        { status: 500 }
      )
    }

    console.log("[API] File uploaded to storage successfully")

    // Extract text content (for .txt files only, PDFs will be handled by backend)
    let textContent = ""
    if (file.type === "text/plain") {
      textContent = await file.text()
      console.log("[API] Extracted text content:", textContent.length, "characters")
    }

    // Create document record in database
    const documentId = crypto.randomUUID()
    const { data: docRecord, error: insertError } = await supabase
      .from("documents")
      .insert({
        id: documentId,
        title: file.name,
        file_name: file.name,
        content: textContent || "", // Will be filled by backend for PDFs
        storage_path: storagePath,
        source: "upload",
        source_type: "file",
        status: "pending",
        user_id: userId
      })
      .select()
      .single()

    if (insertError) {
      console.error("[API] Database insert error:", insertError)

      // Clean up uploaded file
      await supabase.storage
        .from("Multiagent_Skincancer_RAG")
        .remove([storagePath])

      return NextResponse.json(
        { error: "Failed to create document record", details: insertError.message },
        { status: 500 }
      )
    }

    console.log("[API] Document record created:", documentId)

    // Call backend to process document (B+ tree indexing + embeddings)
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000"
    console.log("[API] Calling backend:", `${backendUrl}/api/v1/documents/${documentId}/process`)

    try {
      const backendResponse = await fetch(
        `${backendUrl}/api/v1/documents/${documentId}/process`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ document_id: documentId })
        }
      )

      if (!backendResponse.ok) {
        const errorText = await backendResponse.text()
        console.error("[API] Backend processing error:", errorText)

        // Update document status to failed
        await supabase
          .from("documents")
          .update({ status: "failed" })
          .eq("id", documentId)

        return NextResponse.json(
          { error: "Document uploaded but processing failed", details: errorText },
          { status: 500 }
        )
      }

      const backendData = await backendResponse.json()
      console.log("[API] Backend processing result:", backendData)

      return NextResponse.json({
        success: true,
        message: "Document uploaded and processing started",
        document_id: documentId,
        file_name: file.name,
        status: "processing",
        backend_response: backendData
      })

    } catch (backendError) {
      console.error("[API] Backend call failed:", backendError)

      // Update document status to failed
      await supabase
        .from("documents")
        .update({ status: "failed" })
        .eq("id", documentId)

      return NextResponse.json(
        {
          error: "Document uploaded but backend unreachable",
          details: backendError instanceof Error ? backendError.message : "Unknown error"
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error("[API] Unexpected error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
