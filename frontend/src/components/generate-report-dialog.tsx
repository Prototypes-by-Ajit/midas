"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { IconFileAnalytics, IconSettings } from "@tabler/icons-react"
import { useState } from "react"

import { REPORT_TYPES, type ReportType } from "@/lib/reports/contract"

interface GenerateReportDialogProps {
  open: boolean
  onClose: () => void
  onGenerate: (config: ReportConfig) => void
  analysisId: string
  diagnosis: string
  isGenerating: boolean
}

export interface ReportConfig {
  reportType: ReportType
  includeImages: boolean
  includeDetailedFeatures: boolean
  includeRecommendations: boolean
  includeDisclaimer: boolean
}

/**
 * The four types, their labels, and what each one actually produces.
 *
 * Keyed by `ReportType` rather than re-listed, so the picker cannot drift from
 * the set the backend accepts. It previously offered three, omitting
 * `patient_report` — which the history console then requested by hard-coded
 * string. A type the interface cannot offer is a type nobody can choose.
 *
 * Every description names what the document contains. The old copy for
 * `detailed_analysis` — "Comprehensive report with all detected features" —
 * promised the `detected_features` column, which `report_generator.py:240-243`
 * refuses to read on purpose: it holds pipeline placeholders rather than
 * measurements. None of the four prompts describes lesion morphology, because no
 * morphological assessment is ever supplied to the model.
 */
const REPORT_TYPE_OPTIONS: Record<
  ReportType,
  { label: string; description: string; detailedFeatures: boolean }
> = {
  diagnostic_summary: {
    label: "Diagnostic Summary (Recommended)",
    description:
      "A short summary: what the model found, how certain it was, and what to do next.",
    detailedFeatures: false,
  },
  detailed_analysis: {
    label: "Detailed Analysis",
    description:
      "The same result in more depth — which classes the model weighed against each other, and how close the call was.",
    detailedFeatures: true,
  },
  patient_report: {
    label: "Patient Report",
    description:
      "Plain language throughout, written to be read by the person the analysis is about.",
    detailedFeatures: false,
  },
  clinician_report: {
    label: "Clinician Report",
    description:
      "For a practitioner: clinical interpretation of the probability distribution, the competing classes, and management steps.",
    detailedFeatures: true,
  },
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
                const nextType = e.target.value as ReportType
                setConfig({
                  ...config,
                  reportType: nextType,
                  includeImages: true,
                  includeDetailedFeatures: REPORT_TYPE_OPTIONS[nextType].detailedFeatures,
                  includeRecommendations: true,
                })
              }}
              className="flex h-10 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-black px-3 py-2 text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {REPORT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {REPORT_TYPE_OPTIONS[type].label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              {REPORT_TYPE_OPTIONS[config.reportType].description}
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
