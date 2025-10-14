import { type NextRequest, NextResponse } from "next/server"
import { groq } from "@ai-sdk/groq"
import { generateText } from "ai"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

// Knowledge base for RAG
const knowledgeBase = [
  {
    title: "Melanoma Detection and Classification",
    content:
      "Melanoma is the most dangerous form of skin cancer. The ABCDE rule helps identify suspicious moles: Asymmetry, Border irregularity, Color variation, Diameter larger than 6mm, and Evolving characteristics. Early detection is crucial as melanoma can spread rapidly to other parts of the body.",
    category: "medical" as const,
    keywords: ["melanoma", "ABCDE", "skin cancer", "moles", "detection", "dangerous"],
  },
  {
    title: "Basal Cell Carcinoma Information",
    content:
      "Basal cell carcinoma (BCC) is the most common type of skin cancer, accounting for about 80% of all skin cancers. It typically appears as a pearly or waxy bump, a flat, flesh-colored or brown scar-like lesion, or a bleeding or scabbing sore that heals and returns.",
    category: "medical" as const,
    keywords: ["basal cell", "BCC", "common", "bump", "waxy", "pearly"],
  },
  {
    title: "Squamous Cell Carcinoma Overview",
    content:
      "Squamous cell carcinoma (SCC) is the second most common form of skin cancer. It often appears as a red, scaly patch, an open sore, or a raised growth with a central depression. SCC can develop from actinic keratoses and has a higher risk of spreading than basal cell carcinoma.",
    category: "medical" as const,
    keywords: ["squamous cell", "SCC", "red", "scaly", "patch", "actinic keratoses"],
  },
  {
    title: "MIDAS AI Analysis Process",
    content:
      "MIDAS uses advanced machine learning algorithms to analyze uploaded skin images. The system processes images through multiple neural network layers, comparing patterns against a database of thousands of dermatological cases. Results include confidence scores and recommendations for professional consultation.",
    category: "application" as const,
    keywords: ["MIDAS", "AI", "analysis", "upload", "machine learning", "confidence", "neural network"],
  },
  {
    title: "How to Use Image Upload Feature",
    content:
      "To analyze a skin lesion with MIDAS: 1) Take a clear, well-lit photo of the area, 2) Upload the image using the drag-and-drop interface, 3) Wait for AI processing (usually 30-60 seconds), 4) Review the detailed analysis results, 5) Follow recommendations for next steps including professional consultation if needed.",
    category: "application" as const,
    keywords: ["upload", "image", "photo", "drag", "drop", "processing", "results", "steps"],
  },
  {
    title: "Skin Cancer Prevention Guidelines",
    content:
      "Prevention is key in skin cancer management: Use broad-spectrum SPF 30+ sunscreen daily, seek shade during peak UV hours (10am-4pm), wear protective clothing and wide-brimmed hats, avoid tanning beds, perform monthly self-examinations, and schedule annual dermatologist visits.",
    category: "medical" as const,
    keywords: ["prevention", "sunscreen", "SPF", "UV", "shade", "protection", "self-examination", "dermatologist"],
  },
  {
    title: "Understanding AI Confidence Scores",
    content:
      "MIDAS provides confidence scores ranging from 0-100% for each diagnosis. Scores above 80% indicate high confidence, 60-80% moderate confidence, and below 60% low confidence. Regardless of score, professional medical evaluation is always recommended for suspicious lesions.",
    category: "application" as const,
    keywords: ["confidence", "scores", "percentage", "diagnosis", "professional", "evaluation", "suspicious"],
  },
  {
    title: "Actinic Keratosis Information",
    content:
      "Actinic keratoses are precancerous skin lesions caused by sun damage. They appear as rough, scaly patches on sun-exposed areas like face, ears, hands, and forearms. While not cancerous themselves, they can develop into squamous cell carcinoma if left untreated.",
    category: "medical" as const,
    keywords: ["actinic keratosis", "precancerous", "sun damage", "rough", "scaly", "patches", "squamous cell"],
  },
]

async function retrieveRelevantKnowledge(query: string, limit = 3) {
  const queryLower = query.toLowerCase()

  // Get static knowledge base results
  const staticResults = knowledgeBase.map((item) => {
    let score = 0

    if (item.title.toLowerCase().includes(queryLower)) score += 3
    if (item.content.toLowerCase().includes(queryLower)) score += 2

    const keywordMatches = item.keywords.filter(
      (keyword) => queryLower.includes(keyword.toLowerCase()) || keyword.toLowerCase().includes(queryLower),
    )
    score += keywordMatches.length

    return {
      ...item,
      relevance: score / 10,
      source: "static" as const,
    }
  })

  // Get dynamic document results from database
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    })

    const { data: chunks } = await supabase
      .from("document_chunks")
      .select(`
        *,
        documents (
          title,
          category
        )
      `)
      .textSearch("content", queryLower)
      .limit(limit)

    const dynamicResults =
      chunks?.map((chunk: any) => ({
        title: chunk.documents.title,
        content: chunk.content,
        category: chunk.documents.category,
        keywords: [],
        relevance: 0.8, // High relevance for uploaded documents
        source: "uploaded" as const,
      })) || []

    // Combine and sort all results
    const allResults = [...staticResults, ...dynamicResults]
      .filter((item) => item.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit)

    return allResults
  } catch (error) {
    console.error("Database search error:", error)
    // Fall back to static knowledge base only
    return staticResults
      .filter((item) => item.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { message, history } = await request.json()

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    const relevantKnowledge = await retrieveRelevantKnowledge(message, 3)

    // Build context from retrieved knowledge
    const knowledgeContext =
      relevantKnowledge.length > 0
        ? `\n\nRelevant Information:\n${relevantKnowledge.map((item) => `- ${item.title}: ${item.content}`).join("\n")}`
        : ""

    // Build conversation history
    const conversationHistory =
      history
        ?.slice(-3)
        .map((msg: any) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
        .join("\n") || ""

    const systemPrompt = `You are MIDAS AI Assistant, a specialized medical AI focused on skin cancer detection and dermatological health. You have access to a comprehensive knowledge base about skin cancer, dermatology, and the MIDAS application.

Guidelines:
- Provide accurate, helpful information about skin cancer, dermatology, and the MIDAS system
- Always recommend professional medical consultation for concerning symptoms
- Be empathetic and supportive when discussing health concerns
- Use the retrieved knowledge to provide detailed, evidence-based responses
- If asked about features outside your knowledge base, be honest about limitations
- Never provide definitive medical diagnoses - always emphasize the need for professional evaluation

${knowledgeContext}

Previous conversation:
${conversationHistory}

Respond helpfully and professionally to the user's question.`

    const { text } = await generateText({
      model: groq("llama-3.1-8b-instant"),
      system: systemPrompt,
      prompt: message,
      maxTokens: 1000,
      temperature: 0.7,
    })

    return NextResponse.json({
      response: text,
      sources: relevantKnowledge.map((item) => ({
        title: item.title,
        content: item.content.substring(0, 200) + "...",
        category: item.category,
        relevance: item.relevance,
        source: item.source,
      })),
    })
  } catch (error) {
    console.error("RAG Chat API Error:", error)
    return NextResponse.json({ error: "Failed to process chat request" }, { status: 500 })
  }
}
