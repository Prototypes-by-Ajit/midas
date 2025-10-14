"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { useUser } from "./user-context"

export interface AnalysisResult {
  id: string
  user_id: string
  image_name: string
  image_url: string
  confidence: number
  diagnosis: string
  risk_level: "low" | "medium" | "high"
  recommendations: string[]
  detected_features: string[]
  analysis_date: string
  processing_time: number
}

export interface UserStatistics {
  total_analyses: number
  avg_accuracy: number
  risk_distribution: {
    low: number
    medium: number
    high: number
  }
  recent_analyses: number
  monthly_analyses: number
}

export interface AnalysisReport {
  id: string
  user_id: string
  title: string
  analysis_ids: string[]
  created_date: string
  summary: {
    total_analyses: number
    avg_confidence: number
    risk_distribution: {
      low: number
      medium: number
      high: number
    }
  }
}

interface AnalyticsContextType {
  statistics: UserStatistics
  analysisHistory: AnalysisResult[]
  reports: AnalysisReport[]
  loading: boolean
  addAnalysisResult: (result: Omit<AnalysisResult, 'id' | 'user_id' | 'analysis_date'>) => void
  generateReport: (title: string, analysisIds: string[]) => void
  getAnalysisById: (id: string) => AnalysisResult | undefined
  deleteAnalysis: (id: string) => void
  refreshData: () => void
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined)

export function useAnalytics() {
  const context = useContext(AnalyticsContext)
  if (context === undefined) {
    throw new Error("useAnalytics must be used within an AnalyticsProvider")
  }
  return context
}

interface AnalyticsProviderProps {
  children: React.ReactNode
}

export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  const { profile } = useUser()
  const [statistics, setStatistics] = useState<UserStatistics>({
    total_analyses: 0,
    avg_accuracy: 0,
    risk_distribution: { low: 0, medium: 0, high: 0 },
    recent_analyses: 0,
    monthly_analyses: 0
  })
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisResult[]>([])
  const [reports, setReports] = useState<AnalysisReport[]>([])
  const [loading, setLoading] = useState(false)

  // Load data from localStorage for the current user
  const loadUserData = useCallback(() => {
    if (!profile?.id) return

    try {
      const userKey = `midas_user_${profile.id}`
      
      // Load analysis history
      const historyData = localStorage.getItem(`${userKey}_history`)
      if (historyData) {
        const history = JSON.parse(historyData)
        setAnalysisHistory(history)
      }

      // Load reports
      const reportsData = localStorage.getItem(`${userKey}_reports`)
      if (reportsData) {
        const userReports = JSON.parse(reportsData)
        setReports(userReports)
      }
    } catch (error) {
      console.error('Error loading user data:', error)
    }
  }, [profile?.id])

  // Save data to localStorage
  const saveUserData = useCallback(() => {
    if (!profile?.id) return

    try {
      const userKey = `midas_user_${profile.id}`
      localStorage.setItem(`${userKey}_history`, JSON.stringify(analysisHistory))
      localStorage.setItem(`${userKey}_reports`, JSON.stringify(reports))
    } catch (error) {
      console.error('Error saving user data:', error)
    }
  }, [profile?.id, analysisHistory, reports])

  // Calculate statistics from analysis history
  const calculateStatistics = useCallback(() => {
    if (analysisHistory.length === 0) {
      setStatistics({
        total_analyses: 0,
        avg_accuracy: 0,
        risk_distribution: { low: 0, medium: 0, high: 0 },
        recent_analyses: 0,
        monthly_analyses: 0
      })
      return
    }

    const totalAnalyses = analysisHistory.length
    const avgAccuracy = analysisHistory.reduce((sum, analysis) => sum + analysis.confidence, 0) / totalAnalyses

    const riskDistribution = analysisHistory.reduce((acc, analysis) => {
      acc[analysis.risk_level]++
      return acc
    }, { low: 0, medium: 0, high: 0 })

    // Recent analyses (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const recentAnalyses = analysisHistory.filter(
      analysis => new Date(analysis.analysis_date) >= sevenDaysAgo
    ).length

    // Monthly analyses (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const monthlyAnalyses = analysisHistory.filter(
      analysis => new Date(analysis.analysis_date) >= thirtyDaysAgo
    ).length

    setStatistics({
      total_analyses: totalAnalyses,
      avg_accuracy: Math.round(avgAccuracy * 1000) / 1000, // Round to 3 decimal places
      risk_distribution: riskDistribution,
      recent_analyses: recentAnalyses,
      monthly_analyses: monthlyAnalyses
    })
  }, [analysisHistory])

  // Add new analysis result
  const addAnalysisResult = useCallback((result: Omit<AnalysisResult, 'id' | 'user_id' | 'analysis_date'>) => {
    if (!profile?.id) return

    const newAnalysis: AnalysisResult = {
      ...result,
      id: crypto.randomUUID(),
      user_id: profile.id,
      analysis_date: new Date().toISOString()
    }

    setAnalysisHistory(prev => [newAnalysis, ...prev]) // Add to beginning for most recent first
  }, [profile?.id])

  // Generate new report
  const generateReport = useCallback((title: string, analysisIds: string[]) => {
    if (!profile?.id || analysisIds.length === 0) return

    const selectedAnalyses = analysisHistory.filter(analysis => analysisIds.includes(analysis.id))
    if (selectedAnalyses.length === 0) return

    const avgConfidence = selectedAnalyses.reduce((sum, analysis) => sum + analysis.confidence, 0) / selectedAnalyses.length
    const riskDistribution = selectedAnalyses.reduce((acc, analysis) => {
      acc[analysis.risk_level]++
      return acc
    }, { low: 0, medium: 0, high: 0 })

    const newReport: AnalysisReport = {
      id: crypto.randomUUID(),
      user_id: profile.id,
      title,
      analysis_ids: analysisIds,
      created_date: new Date().toISOString(),
      summary: {
        total_analyses: selectedAnalyses.length,
        avg_confidence: Math.round(avgConfidence * 1000) / 1000,
        risk_distribution: riskDistribution
      }
    }

    setReports(prev => [newReport, ...prev])
  }, [profile?.id, analysisHistory])

  // Get analysis by ID
  const getAnalysisById = useCallback((id: string) => {
    return analysisHistory.find(analysis => analysis.id === id)
  }, [analysisHistory])

  // Delete analysis
  const deleteAnalysis = useCallback((id: string) => {
    setAnalysisHistory(prev => prev.filter(analysis => analysis.id !== id))
    // Also update reports that might reference this analysis
    setReports(prev => prev.map(report => ({
      ...report,
      analysis_ids: report.analysis_ids.filter(analysisId => analysisId !== id)
    })).filter(report => report.analysis_ids.length > 0))
  }, [])

  // Refresh data
  const refreshData = useCallback(() => {
    setLoading(true)
    loadUserData()
    setTimeout(() => setLoading(false), 500) // Small delay for UX
  }, [loadUserData])

  // Load data when user changes
  useEffect(() => {
    loadUserData()
  }, [loadUserData])

  // Save data when it changes
  useEffect(() => {
    saveUserData()
  }, [saveUserData])

  // Recalculate statistics when history changes
  useEffect(() => {
    calculateStatistics()
  }, [calculateStatistics])

  return (
    <AnalyticsContext.Provider
      value={{
        statistics,
        analysisHistory,
        reports,
        loading,
        addAnalysisResult,
        generateReport,
        getAnalysisById,
        deleteAnalysis,
        refreshData,
      }}
    >
      {children}
    </AnalyticsContext.Provider>
  )
}