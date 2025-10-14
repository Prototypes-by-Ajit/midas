"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Upload, FileText, Search, Trash2, Eye, Download, Brain, Database } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Document {
  id: string
  title: string
  content: string
  category: string
  uploadedAt: string
  fileType: string
  size: number
  chunks: number
}

export default function KnowledgeBasePage() {
  const [documents, setDocuments] = useState<Document[]>([
    {
      id: "1",
      title: "Advanced Melanoma Research 2024",
      content: "Comprehensive study on melanoma detection using AI...",
      category: "research",
      uploadedAt: "2024-01-15",
      fileType: "PDF",
      size: 2048576,
      chunks: 45,
    },
    {
      id: "2",
      title: "Dermatology Clinical Guidelines",
      content: "Updated clinical guidelines for skin cancer diagnosis...",
      category: "clinical",
      uploadedAt: "2024-01-10",
      fileType: "DOCX",
      size: 1536000,
      chunks: 32,
    },
  ])

  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    setUploading(true)
    setUploadProgress(0)

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("category", "medical")

        // Simulate upload progress
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => Math.min(prev + 10, 90))
        }, 200)

        const response = await fetch("/api/documents/upload", {
          method: "POST",
          body: formData,
        })

        clearInterval(progressInterval)
        setUploadProgress(100)

        if (response.ok) {
          const result = await response.json()
          setDocuments((prev) => [...prev, result.document])
          toast({
            title: "Document uploaded successfully",
            description: `${file.name} has been processed and added to the knowledge base.`,
          })
        } else {
          throw new Error("Upload failed")
        }
      } catch (error) {
        toast({
          title: "Upload failed",
          description: `Failed to upload ${file.name}. Please try again.`,
          variant: "destructive",
        })
      }
    }

    setUploading(false)
    setUploadProgress(0)
  }

  const handleDeleteDocument = async (id: string) => {
    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setDocuments((prev) => prev.filter((doc) => doc.id !== id))
        toast({
          title: "Document deleted",
          description: "Document has been removed from the knowledge base.",
        })
      }
    } catch (error) {
      toast({
        title: "Delete failed",
        description: "Failed to delete document. Please try again.",
        variant: "destructive",
      })
    }
  }

  const filteredDocuments = documents.filter(
    (doc) =>
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.category.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Knowledge Base Management</h1>
        <p className="text-muted-foreground">
          Upload and manage documents to enhance MIDAS AI responses with your custom knowledge base.
        </p>
      </div>

      <Tabs defaultValue="upload" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload Documents
          </TabsTrigger>
          <TabsTrigger value="manage" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Manage Documents
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload New Documents
              </CardTitle>
              <CardDescription>
                Add medical documents, research papers, or clinical guidelines to enhance AI responses.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                onDrop={(e) => {
                  e.preventDefault()
                  handleFileUpload(e.dataTransfer.files)
                }}
                onDragOver={(e) => e.preventDefault()}
              >
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Drop files here or click to browse</h3>
                <p className="text-muted-foreground mb-4">Supports PDF, DOCX, TXT files up to 10MB each</p>
                <Button variant="outline">Select Files</Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.docx,.txt"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e.target.files)}
                />
              </div>

              {uploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Uploading and processing...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="w-full" />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Document Category</Label>
                  <select className="w-full p-2 border rounded-md">
                    <option value="medical">Medical Research</option>
                    <option value="clinical">Clinical Guidelines</option>
                    <option value="educational">Educational Content</option>
                    <option value="policy">Policy Documents</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <Input placeholder="melanoma, diagnosis, AI, dermatology" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manage" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Search Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="Search by title, content, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {filteredDocuments.map((doc) => (
              <Card key={doc.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <FileText className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold text-lg">{doc.title}</h3>
                        <Badge variant="secondary">{doc.category}</Badge>
                        <Badge variant="outline">{doc.fileType}</Badge>
                      </div>
                      <p className="text-muted-foreground mb-3 line-clamp-2">{doc.content}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Uploaded: {doc.uploadedAt}</span>
                        <span>Size: {formatFileSize(doc.size)}</span>
                        <span>Chunks: {doc.chunks}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteDocument(doc.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{documents.length}</div>
                <p className="text-xs text-muted-foreground">+2 from last week</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total Chunks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{documents.reduce((sum, doc) => sum + doc.chunks, 0)}</div>
                <p className="text-xs text-muted-foreground">Processed segments</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatFileSize(documents.reduce((sum, doc) => sum + doc.size, 0))}
                </div>
                <p className="text-xs text-muted-foreground">of 1GB limit</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Document Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {["medical", "clinical", "research", "educational"].map((category) => {
                  const count = documents.filter((doc) => doc.category === category).length
                  const percentage = documents.length > 0 ? (count / documents.length) * 100 : 0
                  return (
                    <div key={category} className="flex items-center justify-between">
                      <span className="capitalize">{category}</span>
                      <div className="flex items-center gap-3">
                        <Progress value={percentage} className="w-24" />
                        <span className="text-sm text-muted-foreground w-8">{count}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
