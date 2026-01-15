"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { IconDownload, IconX, IconExternalLink } from "@tabler/icons-react"
import { useState } from "react"

interface ReportPreviewDialogProps {
  open: boolean
  onClose: () => void
  reportUrl: string
  reportTitle: string
  reportId: string
  onDownload: () => void
}

export function ReportPreviewDialog({
  open,
  onClose,
  reportUrl,
  reportTitle,
  reportId,
  onDownload
}: ReportPreviewDialogProps) {
  const [isLoading, setIsLoading] = useState(true)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex-none">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-semibold text-black dark:text-white">
                {reportTitle}
              </DialogTitle>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Report ID: {reportId}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onDownload}
                className="border-black text-black hover:bg-black hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black"
              >
                <IconDownload className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(reportUrl, '_blank')}
                className="text-gray-600 hover:text-black dark:text-gray-400 dark:hover:text-white"
              >
                <IconExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* PDF Preview */}
        <div className="flex-1 relative bg-gray-100 dark:bg-gray-900">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-black z-10">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Loading report preview...</p>
              </div>
            </div>
          )}
          <iframe
            src={reportUrl}
            className="w-full h-full border-0"
            title={reportTitle}
            onLoad={() => setIsLoading(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
