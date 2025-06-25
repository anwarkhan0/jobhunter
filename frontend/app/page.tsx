"use client"

import { useState } from "react"
import { Search, FileText, FileSpreadsheet, Briefcase, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/hooks/use-toast"

interface Job {
  id: string
  title: string
  description: string
  link: string
  company: string
  location: string
  salary?: string
}

interface JobSite {
  id: string
  name: string
  domain: string
  jobs: Job[]
}

const availableSites = [
  { id: "expatriates", name: "Expatriates", domain: "https://www.expatriates.com" },
  { id: "mourjan", name: "Mourjan", domain: "https://www.mourjan.com/" },
]

const timeFilters = [
  { label: "Any time", value: "" },
  { label: "Last 24 hours", value: "24h" },
  { label: "Last 7 days", value: "7d" },
]

export default function JobSearchApp() {
  const [selectedSites, setSelectedSites] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [results, setResults] = useState<JobSite[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [progress, setProgress] = useState(0)
  const [total, setTotal] = useState(1)
  const [timeFilter, setTimeFilter] = useState<string>("")

  const handleSiteToggle = (siteId: string) => {
    setSelectedSites((prev) => (prev.includes(siteId) ? prev.filter((id) => id !== siteId) : [...prev, siteId]))
  }

  const handleSearch = async () => {
    if (selectedSites.length === 0) {
      toast({
        title: "No sites selected",
        description: "Please select at least one job site to search.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    setHasSearched(true)
    setProgress(0)
    setTotal(selectedSites.length)

    try {
      // 1. Start the scrape job
      const response = await fetch("http://localhost:3001/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websites: selectedSites.map((siteId) => {
            // Map siteId to actual domain/url if needed
            if (siteId === "expatriates") return "https://www.expatriates.com"
            if (siteId === "mourjan") return "https://www.mourjan.com/"
            // Add more mappings as needed
            return siteId
          }),
          query: searchQuery,
          time: timeFilter, // <-- send time filter to backend
        }),
      })

      if (!response.ok) throw new Error("Failed to start job")

      const { jobId } = await response.json()

      // 2. Poll for results (no poll limit)
      let jobResult = null
      while (true) {
        const res = await fetch(`http://localhost:3001/results/${jobId}`)
        const data = await res.json()
        setProgress(data.progress || 0)
        setTotal(data.total || 1)
        if (data.status === "done") {
          jobResult = data.result
          break
        }
        await new Promise((r) => setTimeout(r, 1000)) // Wait 1s
      }

      if (!jobResult) throw new Error("Timed out waiting for results")

      // Map backend structure to JobSite structure expected by frontend
      const mappedResults = jobResult.map((site: any) => ({
        id: site.website, // or extract a unique id if needed
        name: site.website.replace(/^https?:\/\/(www\.)?/, '').split('.')[0].charAt(0).toUpperCase() + site.website.replace(/^https?:\/\/(www\.)?/, '').split('.')[0].slice(1),
        domain: site.website,
        jobs: Array.isArray(site.data) ? site.data.map((job: any, idx: number) => ({
          id: job.id || `${site.website}-${idx}`,
          title: job.title,
          description: job.description,
          link: job.link,
          company: job.company || "",
          location: job.location || "",
          salary: job.salary || "",
        })) : [],
      }));

      setResults(mappedResults)
      toast({
        title: "Search completed",
        description: `Found jobs from ${mappedResults.length} sites.`,
      })
    } catch (error) {
      console.error("Search error:", error)
      toast({
        title: "Search failed",
        description: "There was an error searching for jobs. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const downloadCSV = () => {
    const csvData = []
    csvData.push(["Site", "Job Title", "Company", "Location", "Salary", "Description", "Link"])

    results.forEach((site) => {
      site.jobs.forEach((job) => {
        csvData.push([
          site.domain,
          job.title,
          job.company,
          job.location,
          job.salary || "Not specified",
          job.description.replace(/,/g, ";"), // Replace commas to avoid CSV issues
          job.link,
        ])
      })
    })

    const csvContent = csvData.map((row) => row.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `job-search-results-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)

    toast({
      title: "CSV Downloaded",
      description: "Your job search results have been downloaded as CSV.",
    })
  }

  const downloadPDF = async () => {
    try {
      const response = await fetch("/api/jobs/export-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ results, query: searchQuery }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate PDF")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `job-search-results-${new Date().toISOString().split("T")[0]}.pdf`
      a.click()
      window.URL.revokeObjectURL(url)

      toast({
        title: "PDF Downloaded",
        description: "Your job search results have been downloaded as PDF.",
      })
    } catch (error) {
      console.error("PDF export error:", error)
      toast({
        title: "PDF Export Failed",
        description: "There was an error generating the PDF. Please try again.",
        variant: "destructive",
      })
    }
  }

  const totalJobs = Array.isArray(results)
    ? results.reduce((sum, site) => sum + (Array.isArray(site.jobs) ? site.jobs.length : 0), 0)
    : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Job Hunt With One Shot</h1>
          <p className="text-lg text-gray-600">Search multiple job sites at once and download results</p>
        </div>

        {/* Search Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Search Configuration
            </CardTitle>
            <CardDescription>Select job sites and enter your search criteria</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Site Selection */}
            <div>
              <h3 className="text-sm font-medium mb-3">Select Job Sites</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {availableSites.map((site) => (
                  <div key={site.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={site.id}
                      checked={selectedSites.includes(site.id)}
                      onCheckedChange={() => handleSiteToggle(site.id)}
                    />
                    <label
                      htmlFor={site.id}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {site.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Search Input */}
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Enter job title, keywords, or company name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <Button onClick={handleSearch} disabled={isLoading} className="px-6">
                {isLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                {isLoading ? "Searching..." : "Search"}
              </Button>
            </div>

            {/* Time Filter */}
            <div>
              <h3 className="text-sm font-medium mb-3">Time Filter</h3>
              <div className="flex gap-2">
                {timeFilters.map((filter) => (
                  <Button
                    key={filter.value}
                    variant={timeFilter === filter.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTimeFilter(filter.value)}
                    className="flex-1"
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Progress Bar */}
        {isLoading && (
          <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
            <div
              className="bg-blue-600 h-4 rounded-full transition-all"
              style={{ width: `${Math.round((progress / total) * 100)}%` }}
            />
            <div className="text-center text-xs mt-1">
              {progress} of {total} sites scraped...
            </div>
          </div>
        )}

        {/* Results Section */}
        {hasSearched && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Search Results
                    {totalJobs > 0 && <Badge variant="secondary">{totalJobs} jobs found</Badge>}
                  </CardTitle>
                  <CardDescription>
                    {isLoading ? "Searching job sites..." : `Results from ${results.length} sites`}
                  </CardDescription>
                </div>
                {results.length > 0 && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={downloadCSV}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={downloadPDF}>
                      <FileText className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {results.length === 0 && isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
                  <span className="ml-3 text-gray-600">Searching job sites...</span>
                </div>
              ) : results.length === 0 ? (
                <div className="text-center py-12">
                  <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No jobs found. Try adjusting your search criteria.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {results.map((site, index) => (
                    <div key={site.id}>
                      {/* Site Header */}
                      <div className="flex items-center gap-3 mb-4">
                        <h2 className="text-xl font-semibold text-gray-900">{site.name}</h2>
                        <Badge variant="outline">{Array.isArray(site.jobs) ? site.jobs.length : 0} jobs</Badge>
                        <span className="text-sm text-gray-500">({site.domain})</span>
                        {isLoading && site.jobs.length === 0 && (
                          <span className="ml-2 text-xs text-blue-500 animate-pulse">Loading...</span>
                        )}
                      </div>
                      {/* Jobs List */}
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {site.jobs.map((job) => (
                          <Card key={job.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="space-y-2">
                                <h3 className="font-semibold text-gray-900 line-clamp-2">{job.title}</h3>
                                <p className="text-sm text-gray-600">{job.company}</p>
                                <p className="text-sm text-gray-500">{job.location}</p>
                                {job.salary && <p className="text-sm font-medium text-green-600">{job.salary}</p>}
                                <p className="text-sm text-gray-700 line-clamp-3">{job.description}</p>
                                <a
                                  href={job.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
                                >
                                  View Job <ExternalLink className="h-3 w-3 ml-1" />
                                </a>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                      {index < results.length - 1 && <Separator className="mt-8" />}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
