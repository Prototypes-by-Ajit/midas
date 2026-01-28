import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createClient } from "@supabase/supabase-js"

const getSupabaseAdmin = () => {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY

  if (!url || !key) {
    throw new Error("Supabase admin env vars are missing")
  }

  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { sessionId } = await params
    const supabase = getSupabaseAdmin()
    
    let { data: sessionRow, error: sessionError } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .maybeSingle()

    if (sessionError) {
      return NextResponse.json({ error: "Failed to fetch session" }, { status: 500 })
    }
    
    // If session doesn't exist, create it
    if (!sessionRow) {
      const { data: newSession, error: createError } = await supabase
        .from("sessions")
        .insert({
          id: sessionId,
          user_id: userId,
          title: "New Chat",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
        })
        .select()
        .single()
      
      if (createError) {
        return NextResponse.json({ error: "Failed to create session" }, { status: 500 })
      }
      sessionRow = newSession
    }

    return NextResponse.json(sessionRow)
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { sessionId } = await params

    const supabase = getSupabaseAdmin()
    const { data: sessionRow, error: sessionError } = await supabase
      .from("sessions")
      .select("id, user_id")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .maybeSingle()

    if (sessionError) {
      return NextResponse.json({ error: "Failed to fetch session" }, { status: 500 })
    }
    if (!sessionRow) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const { error } = await supabase.from("sessions").delete().eq("id", sessionId)
    if (error) {
      return NextResponse.json({ error: "Failed to delete conversation" }, { status: 500 })
    }

    return NextResponse.json({ deleted: true })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
