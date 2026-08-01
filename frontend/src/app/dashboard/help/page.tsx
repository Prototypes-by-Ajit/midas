import type { Metadata } from "next"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  IconBook,
  IconExternalLink,
  IconHelp,
  IconMessageCircle,
  IconQuestionMark,
  IconSearch,
} from "@tabler/icons-react"
import {
  FAQS,
  HELP_RESOURCES,
  QUICK_HELP,
  SERVICE_STATUSES,
  SUPPORT_CHANNELS,
} from "@/data/dashboard/help"

export const metadata: Metadata = {
  title: "Help & Support",
  description: "Find answers, guides, and get support for your MIDAS AI platform.",
}

/** Server Component — this page has no state, effects or handlers. */
export default function HelpPage() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <IconHelp className="h-6 w-6 sm:h-8 sm:w-8 shrink-0" />
          Help &amp; Support
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Find answers, guides, and get support for your MIDAS AI platform
        </p>
      </div>

      {/* Search — note: not wired to anything yet */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-4">
            <h2 className="text-lg sm:text-xl font-semibold">Search Help Articles</h2>
            <div className="relative">
              <label htmlFor="help-search" className="sr-only">
                Search help articles
              </label>
              <IconSearch className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="help-search"
                placeholder="Search for help articles, guides, or FAQs..."
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Help */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold mb-4">Quick Help</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_HELP.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base">{title}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <CardDescription className="mb-3">{description}</CardDescription>
                <Button variant="ghost" size="sm" className="p-0 h-auto">
                  Learn more <IconExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Contact Support + Resources */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconMessageCircle className="h-5 w-5 shrink-0" />
              Get Support
            </CardTitle>
            <CardDescription>Choose how you&apos;d like to get help from our team</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {SUPPORT_CHANNELS.map(({ icon: Icon, label, badge }) => (
              <Button key={label} className="w-full justify-start" variant="outline">
                <Icon className="h-4 w-4 mr-2 shrink-0" />
                <span className="truncate">{label}</span>
                {badge && (
                  <Badge variant="secondary" className="ml-auto shrink-0">
                    {badge}
                  </Badge>
                )}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconBook className="h-5 w-5 shrink-0" />
              Resources
            </CardTitle>
            <CardDescription>Documentation and learning materials</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {HELP_RESOURCES.map(({ icon: Icon, label, badge, external }) => (
              <Button key={label} className="w-full justify-start" variant="outline">
                <Icon className="h-4 w-4 mr-2 shrink-0" />
                <span className="truncate">{label}</span>
                {badge && (
                  <Badge variant="secondary" className="ml-auto shrink-0">
                    {badge}
                  </Badge>
                )}
                {external && <IconExternalLink className="h-3 w-3 ml-auto shrink-0" />}
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* FAQ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconQuestionMark className="h-5 w-5 shrink-0" />
            Frequently Asked Questions
          </CardTitle>
          <CardDescription>Common questions and answers about MIDAS AI</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {FAQS.map((faq) => (
              <div key={faq.question} className="border-b last:border-b-0 pb-4 last:pb-0">
                <h3 className="font-semibold text-base sm:text-lg mb-2">{faq.question}</h3>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                  {faq.answer}
                </p>
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

      {/* System Status — note: hard-coded, not a live status feed */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
          <CardDescription>Current status of MIDAS AI services</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {SERVICE_STATUSES.map((item) => (
              <div
                key={item.service}
                className="flex items-center justify-between gap-3 p-3 bg-muted/30 rounded-lg"
              >
                <span className="font-medium text-sm sm:text-base truncate">{item.service}</span>
                <Badge
                  variant="outline"
                  className={`capitalize shrink-0 ${item.color} border-current`}
                >
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
