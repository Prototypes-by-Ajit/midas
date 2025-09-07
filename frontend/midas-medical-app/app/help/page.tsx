import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">M</span>
              </div>
              <span className="text-xl font-bold text-foreground">MIDAS</span>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline">Back to Dashboard</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-4">Help & Support</h1>
          <p className="text-muted-foreground">Find answers to common questions and get support</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* FAQ Section */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Frequently Asked Questions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold text-foreground mb-2">How accurate is the AI analysis?</h3>
                  <p className="text-muted-foreground">
                    Our AI system has been clinically validated with 99.2% accuracy across multiple skin cancer types.
                    However, AI results should always be reviewed by a qualified healthcare professional.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">What image quality is required?</h3>
                  <p className="text-muted-foreground">
                    For best results, images should be well-lit, in focus, and show the lesion clearly. Avoid shadows,
                    reflections, and ensure the lesion fills most of the frame.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">How long does analysis take?</h3>
                  <p className="text-muted-foreground">
                    Most analyses are completed within 3 seconds. Complex cases may take up to 30 seconds.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Is my data secure?</h3>
                  <p className="text-muted-foreground">
                    Yes, we are fully HIPAA compliant with end-to-end encryption, secure data storage, and comprehensive
                    audit logging.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Can I share results with my doctor?</h3>
                  <p className="text-muted-foreground">
                    You can download PDF reports or share results directly through our secure platform.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Contact Form */}
            <Card>
              <CardHeader>
                <CardTitle>Contact Support</CardTitle>
                <CardDescription>Can't find what you're looking for? Send us a message</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Name</label>
                    <Input placeholder="Your name" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email</label>
                    <Input type="email" placeholder="your.email@example.com" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Subject</label>
                  <Input placeholder="How can we help?" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Message</label>
                  <Textarea placeholder="Describe your question or issue..." rows={4} />
                </div>
                <Button className="w-full">Send Message</Button>
              </CardContent>
            </Card>
          </div>

          {/* Quick Links */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Quick Links</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link href="/dashboard" className="block">
                  <Button variant="outline" className="w-full justify-start bg-transparent">
                    Dashboard
                  </Button>
                </Link>
                <Link href="/dashboard/history" className="block">
                  <Button variant="outline" className="w-full justify-start bg-transparent">
                    Analysis History
                  </Button>
                </Link>
                <Link href="/dashboard/profile" className="block">
                  <Button variant="outline" className="w-full justify-start bg-transparent">
                    Profile Settings
                  </Button>
                </Link>
                <Link href="/privacy" className="block">
                  <Button variant="outline" className="w-full justify-start bg-transparent">
                    Privacy Policy
                  </Button>
                </Link>
                <Link href="/terms" className="block">
                  <Button variant="outline" className="w-full justify-start bg-transparent">
                    Terms of Service
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">AI Analysis</span>
                  <Badge className="bg-primary text-primary-foreground">Operational</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Image Upload</span>
                  <Badge className="bg-primary text-primary-foreground">Operational</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Database</span>
                  <Badge className="bg-primary text-primary-foreground">Operational</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">API Services</span>
                  <Badge className="bg-primary text-primary-foreground">Operational</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Emergency Contact</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  For urgent medical concerns, contact your healthcare provider immediately or call emergency services.
                </p>
                <p className="text-sm font-medium">Technical Support: 1-800-MIDAS-HELP</p>
                <p className="text-sm font-medium">Email: support@midas-medical.com</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
