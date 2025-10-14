import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const category = formData.get("category") as string

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Create Supabase client
    const cookieStore = cookies()
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    })

    // Read file content
    const fileContent = await file.text()

    // Process document into chunks
    const chunks = processDocumentIntoChunks(fileContent)

    // Store document in database
    const { data: document, error: dbError } = await supabase
      .from("documents")
      .insert({
        title: file.name.replace(/\.[^/.]+$/, ""), // Remove file extension
        content: fileContent.substring(0, 1000), // Store preview
        full_content: fileContent,
        category: category || "medical",
        file_type: file.type,
        file_size: file.size,
        chunk_count: chunks.length,
        uploaded_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (dbError) {
      console.error("Database error:", dbError)
      return NextResponse.json({ error: "Failed to store document" }, { status: 500 })
    }

    // Store chunks for RAG
    const chunkInserts = chunks.map((chunk, index) => ({
      document_id: document.id,
      content: chunk,
      chunk_index: index,
      embedding: null, // Would store vector embeddings in production
    }))

    const { error: chunksError } = await supabase.from("document_chunks").insert(chunkInserts)

    if (chunksError) {
      console.error("Chunks error:", chunksError)
    }

    return NextResponse.json({
      document: {
        id: document.id,
        title: document.title,
        content: document.content,
        category: document.category,
        uploadedAt: document.uploaded_at,
        fileType: document.file_type,
        size: document.file_size,
        chunks: document.chunk_count,
      },
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}

function processDocumentIntoChunks(content: string, chunkSize = 1000): string[] {
  const chunks: string[] = []
  const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0)

  let currentChunk = ""

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim())
      currentChunk = sentence
    } else {
      currentChunk += (currentChunk ? ". " : "") + sentence
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }

  return chunks
}
