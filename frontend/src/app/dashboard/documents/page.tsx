"use client"



import { useEffect, useState } from "react"
import { useUser } from "@clerk/nextjs"
import { useRole } from "@/contexts/role-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { LifeLine } from "@/components/ui/lifeline-loader"
import { toast } from "sonner"
import { FileText, Upload, Trash2, Shield, Download, FileCheck } from "lucide-react"
import { Input } from "@/components/ui/input"

interface Document {
  id: string
  name: string
  size: number
  uploadedAt: string
  uploadedBy: string
  status: 'pending' | 'processed' | 'failed'
}

export default function DocumentsManagementPage() {
  const { user: currentUser, isLoaded } = useUser()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  // Resolved on the server in the dashboard layout — known on first render.
  const isClinician = useRole() === 'clinician'

  useEffect(() => {
    if (!isLoaded || !currentUser) return
    if (isClinician) {
      fetchDocuments()
    } else {
      setLoading(false)
    }
  }, [isLoaded, currentUser, isClinician])

  const fetchDocuments = async () => {
    try {
      const response = await fetch('/api/documents')

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('API Error:', response.status, errorData)
        throw new Error(errorData.error || `Failed to fetch documents (${response.status})`)
      }

      const data = await response.json()
      setDocuments(data.documents || [])
    } catch (error) {
      console.error('Error fetching documents:', error)
      toast.error("Error", {
        description: error instanceof Error ? error.message : "Failed to load documents. Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setUploading(true)

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`)
        }
      }

      toast.success("Success", {
        description: `${files.length} document(s) uploaded successfully`,
      })

      // Refresh document list
      fetchDocuments()
    } catch (error) {
      console.error('Error uploading documents:', error)
      toast.error("Error", {
        description: "Failed to upload documents. Please try again.",
      })
    } finally {
      setUploading(false)
      // Reset file input
      event.target.value = ''
    }
  }

  const handleDeleteDocument = async (documentId: string, documentName: string) => {
    if (!confirm(`Are you sure you want to delete "${documentName}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete document')
      }

      toast.success("Success", {
        description: "Document deleted successfully",
      })

      // Refresh document list
      fetchDocuments()
    } catch (error) {
      console.error('Error deleting document:', error)
      toast.error("Error", {
        description: "Failed to delete document. Please try again.",
      })
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'processed':
        return <Badge className="bg-success-subtle text-success">Processed</Badge>
      case 'pending':
        return <Badge className="bg-warning-subtle text-warning">Processing</Badge>
      case 'failed':
        return <Badge className="bg-critical-subtle text-critical">Failed</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  if (!isLoaded || loading) {
    return (
      <div className="flex h-[calc(100vh-var(--header-height))] items-center justify-center">
        <LifeLine
          color="#3b82f6"
          size="medium"
          text="Loading documents..."
          textColor="#6b7280"
        />
      </div>
    )
  }

  if (!isClinician) {
    return (
      <div className="flex h-[calc(100vh-var(--header-height))] items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-critical" />
              Access Denied
            </CardTitle>
            <CardDescription>
              You don't have permission to access this page. Clinician or Admin access is required.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <FileText className="h-8 w-8" />
          Document Management
        </h1>
        <p className="text-muted-foreground">
          Upload and manage medical documents for the Multi-Agent RAG system
        </p>
      </div>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Documents</CardTitle>
          <CardDescription>
            Upload PDF, TXT, or Markdown files to add to the knowledge base
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Input
              type="file"
              accept=".pdf,.txt,.md"
              multiple
              onChange={handleFileUpload}
              disabled={uploading}
              className="flex-1"
            />
            <Button disabled={uploading}>
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Supported formats: PDF, TXT, MD. Maximum file size: 10MB per file.
          </p>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{documents.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Processed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {documents.filter((d) => d.status === 'processed').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {documents.filter((d) => d.status === 'pending').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Documents Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Documents</CardTitle>
          <CardDescription>
            Manage uploaded documents in the knowledge base
          </CardDescription>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="text-center py-12">
              <FileCheck className="h-12 w-12 mx-auto mb-4 text-gray-300 dark:text-muted-foreground" />
              <h3 className="text-lg font-medium text-foreground mb-2">No documents yet</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Upload your first document to get started
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document Name</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Uploaded By</TableHead>
                    <TableHead>Upload Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <span className="font-medium">{doc.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{formatFileSize(doc.size)}</TableCell>
                      <TableCell>{doc.uploadedBy}</TableCell>
                      <TableCell>
                        {new Date(doc.uploadedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{getStatusBadge(doc.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteDocument(doc.id, doc.name)}
                          >
                            <Trash2 className="h-4 w-4 text-critical" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}