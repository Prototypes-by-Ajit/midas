"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { 
  IconHelp, 
  IconSearch, 
  IconBook, 
  IconMessageCircle,
  IconMail,
  IconVideo,
  IconDownload,
  IconExternalLink,
  IconQuestionMark,
  IconBrain,
  IconScanEye,
  IconRobot
} from "@tabler/icons-react"

export default function HelpPage() {
  const quickHelp = [
    {
      title: "Getting Started",
      description: "Learn the basics of MIDAS AI platform",
      icon: <IconBrain className="h-5 w-5" />,
      link: "/docs/getting-started"
    },
    {
      title: "AI Analysis Guide",
      description: "How to perform skin lesion analysis",
      icon: <IconScanEye className="h-5 w-5" />,
      link: "/docs/analysis"
    },
    {
      title: "AI Assistant Help",
      description: "Using the medical AI assistant",
      icon: <IconRobot className="h-5 w-5" />,
      link: "/docs/assistant"
    },
    {
      title: "Account & Billing",
      description: "Manage your account and subscription",
      icon: <IconQuestionMark className="h-5 w-5" />,
      link: "/docs/account"
    }
  ]

  const faqs = [
    {
      question: "How accurate is the AI diagnosis?",
      answer: "MIDAS AI achieves 99.2% clinical accuracy, matching or exceeding expert dermatologist performance in controlled studies."
    },
    {
      question: "What types of skin lesions can MIDAS analyze?",
      answer: "MIDAS can analyze 8 different types of skin lesions including melanoma, basal cell carcinoma, squamous cell carcinoma, and various benign lesions."
    },
    {
      question: "Is my medical data secure?",
      answer: "Yes, MIDAS is fully HIPAA compliant with end-to-end encryption and enterprise-grade security measures."
    },
    {
      question: "Can I use MIDAS for multiple patients?",
      answer: "Yes, MIDAS supports multi-patient workflows with role-based access control and comprehensive audit trails."
    },
    {
      question: "How long does analysis take?",
      answer: "Most analyses complete in under 2 minutes, with real-time progress updates and detailed reporting."
    }
  ]

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <IconHelp className="h-8 w-8" />
          Help & Support
        </h1>
        <p className="text-muted-foreground">
          Find answers, guides, and get support for your MIDAS AI platform
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold">Search Help Articles</h2>
            <div className="relative">
              <IconSearch className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search for help articles, guides, or FAQs..." 
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Help */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Quick Help</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {quickHelp.map((item, index) => (
            <Card key={index} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    {item.icon}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">{item.title}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <CardDescription className="mb-3">
                  {item.description}
                </CardDescription>
                <Button variant="ghost" size="sm" className="p-0 h-auto">
                  Learn more <IconExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Contact Support */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconMessageCircle className="h-5 w-5" />
              Get Support
            </CardTitle>
            <CardDescription>
              Choose how you&apos;d like to get help from our team
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full justify-start" variant="outline">
              <IconMessageCircle className="h-4 w-4 mr-2" />
              Live Chat Support
              <Badge variant="secondary" className="ml-auto">
                Available 24/7
              </Badge>
            </Button>
            
            <Button className="w-full justify-start" variant="outline">
              <IconMail className="h-4 w-4 mr-2" />
              Email Support
              <Badge variant="secondary" className="ml-auto">
                Response in 2-4 hours
              </Badge>
            </Button>
            
            <Button className="w-full justify-start" variant="outline">
              <IconVideo className="h-4 w-4 mr-2" />
              Schedule Video Call
              <Badge variant="secondary" className="ml-auto">
                Enterprise only
              </Badge>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconBook className="h-5 w-5" />
              Resources
            </CardTitle>
            <CardDescription>
              Documentation and learning materials
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full justify-start" variant="outline">
              <IconBook className="h-4 w-4 mr-2" />
              Documentation
              <IconExternalLink className="h-3 w-3 ml-auto" />
            </Button>
            
            <Button className="w-full justify-start" variant="outline">
              <IconVideo className="h-4 w-4 mr-2" />
              Video Tutorials
              <IconExternalLink className="h-3 w-3 ml-auto" />
            </Button>
            
            <Button className="w-full justify-start" variant="outline">
              <IconDownload className="h-4 w-4 mr-2" />
              User Manual (PDF)
              <Badge variant="secondary" className="ml-auto">
                v2.1
              </Badge>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* FAQ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconQuestionMark className="h-5 w-5" />
            Frequently Asked Questions
          </CardTitle>
          <CardDescription>
            Common questions and answers about MIDAS AI
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <div key={index} className="border-b last:border-b-0 pb-4 last:pb-0">
                <h3 className="font-semibold text-lg mb-2">{faq.question}</h3>
                <p className="text-muted-foreground leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
          
          <div className="mt-6 pt-6 border-t">
            <p className="text-sm text-muted-foreground mb-3">
              Can&apos;t find what you&apos;re looking for?
            </p>
            <Button>
              View All FAQs <IconExternalLink className="h-3 w-3 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
          <CardDescription>
            Current status of MIDAS AI services
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { service: "AI Analysis Engine", status: "operational", color: "text-green-600" },
              { service: "AI Assistant", status: "operational", color: "text-green-600" },
              { service: "Image Processing", status: "operational", color: "text-green-600" },
              { service: "Report Generation", status: "maintenance", color: "text-yellow-600" },
              { service: "Data Sync", status: "operational", color: "text-green-600" }
            ].map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="font-medium">{item.service}</span>
                <Badge variant="outline" className={`capitalize ${item.color} border-current`}>
                  {item.status}
                </Badge>
              </div>
            ))}
          </div>
          
          <div className="mt-4 pt-4 border-t">
            <Button variant="outline" className="w-full">
              View Status Page <IconExternalLink className="h-3 w-3 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}