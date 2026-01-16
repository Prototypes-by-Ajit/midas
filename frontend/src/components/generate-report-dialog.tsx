"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { IconFileAnalytics, IconSettings } from "@tabler/icons-react"
import { useState } from "react"

interface GenerateReportDialogProps {
  open: boolean
  onClose: () => void
  onGenerate: (config: ReportConfig) => void
  analysisId: string
  diagnosis: string
  isGenerating: boolean
}

export interface ReportConfig {
  reportType: 'diagnostic_summary' | 'detailed_analysis' | 'clinician_report'
  includeImages: boolean
  includeDetailedFeatures: boolean
  includeRecommendations: boolean
  includeDisclaimer: boolean
}

export function GenerateReportDialog({
  open,
  onClose,
  onGenerate,
  analysisId,
  diagnosis,
  isGenerating
}: GenerateReportDialogProps) {
  const [config, setConfig] = useState<ReportConfig>({
    reportType: 'diagnostic_summary',
    includeImages: true,
    includeDetailedFeatures: true,
    includeRecommendations: true,
    includeDisclaimer: true
  })

  const handleGenerate = () => {
    onGenerate(config)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-black dark:text-white">
            <IconFileAnalytics className="h-5 w-5" />
            Generate Medical Report
          </DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-400">
            Configure your report settings before generation
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Analysis Info */}
          <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Analysis ID:</span>
              <span className="text-sm text-black dark:text-white font-mono">{analysisId.slice(0, 8)}...</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Diagnosis:</span>
              <span className="text-sm text-black dark:text-white font-medium">{diagnosis}</span>
            </div>
          </div>

          {/* Report Type Selection */}
          <div className="space-y-3">
            <Label className="text-black dark:text-white flex items-center gap-2">
              <IconSettings className="h-4 w-4" />
              Report Type
            </Label>
            <select
              value={config.reportType}
              onChange={(e) => {
                const nextType = e.target.value as ReportConfig['reportType']
                const baseConfig = {
                  ...config,
                  reportType: nextType
                }

                if (nextType === 'diagnostic_summary') {
                  setConfig({
                    ...baseConfig,
                    includeImages: true,
                    includeDetailedFeatures: false,
                    includeRecommendations: true
                  })
                  return
                }

                if (nextType === 'detailed_analysis') {
                  setConfig({
                    ...baseConfig,
                    includeImages: true,
                    includeDetailedFeatures: true,
                    includeRecommendations: true
                  })
                  return
                }

                setConfig({
                  ...baseConfig,
                  includeImages: true,
                  includeDetailedFeatures: true,
                  includeRecommendations: true
                })
              }}
              className="flex h-10 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-black px-3 py-2 text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="diagnostic_summary">Diagnostic Summary (Recommended)</option>
              <option value="detailed_analysis">Detailed Analysis Report</option>
              <option value="clinician_report">Clinician Report</option>
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              {config.reportType === 'diagnostic_summary' && 'A concise summary suitable for patient records'}
              {config.reportType === 'detailed_analysis' && 'Comprehensive report with all detected features'}
              {config.reportType === 'clinician_report' && 'Professional report for medical practitioners'}
            </p>
          </div>

          {/* Report Options */}
          <div className="space-y-4">
            <Label className="text-black dark:text-white">Report Content</Label>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label htmlFor="include-images" className="text-sm font-medium text-black dark:text-white">
                    Include Images
                  </Label>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                    Embed analyzed images in the report
                  </p>
                </div>
                <Switch
                  id="include-images"
                  checked={config.includeImages}
                  onCheckedChange={(checked) => setConfig({ ...config, includeImages: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label htmlFor="include-features" className="text-sm font-medium text-black dark:text-white">
                    Detailed Features
                  </Label>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                    Include all detected features and measurements
                  </p>
                </div>
                <Switch
                  id="include-features"
                  checked={config.includeDetailedFeatures}
                  onCheckedChange={(checked) => setConfig({ ...config, includeDetailedFeatures: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label htmlFor="include-recommendations" className="text-sm font-medium text-black dark:text-white">
                    Recommendations
                  </Label>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                    Include clinical recommendations
                  </p>
                </div>
                <Switch
                  id="include-recommendations"
                  checked={config.includeRecommendations}
                  onCheckedChange={(checked) => setConfig({ ...config, includeRecommendations: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label htmlFor="include-disclaimer" className="text-sm font-medium text-black dark:text-white">
                    Medical Disclaimer
                  </Label>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                    Include AI disclaimer and consultation notice
                  </p>
                </div>
                <Switch
                  id="include-disclaimer"
                  checked={config.includeDisclaimer}
                  onCheckedChange={(checked) => setConfig({ ...config, includeDisclaimer: checked })}
                  disabled
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isGenerating}
            className="border-gray-300 text-black hover:bg-gray-100 dark:border-gray-700 dark:text-white dark:hover:bg-gray-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isGenerating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Generating...
              </>
            ) : (
              <>
                <IconFileAnalytics className="h-4 w-4 mr-2" />
                Generate Report
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
