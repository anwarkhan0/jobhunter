import { type NextRequest, NextResponse } from "next/server"

interface SearchRequest {
  sites: string[]
  query: string
}

// Mock job data generator
const generateMockJobs = (siteName: string, domain: string, query: string, count: number) => {
  const jobTitles = [
    "Senior Software Engineer",
    "Frontend Developer",
    "Full Stack Developer",
    "Product Manager",
    "Data Scientist",
    "UX Designer",
    "DevOps Engineer",
    "Backend Developer",
    "Mobile Developer",
    "Technical Lead",
  ]

  const companies = [
    "TechCorp Inc.",
    "Innovation Labs",
    "Digital Solutions",
    "Future Systems",
    "CloudTech",
    "DataFlow Inc.",
    "NextGen Software",
    "Quantum Computing Co.",
    "AI Dynamics",
    "WebScale Solutions",
  ]

  const locations = [
    "San Francisco, CA",
    "New York, NY",
    "Seattle, WA",
    "Austin, TX",
    "Boston, MA",
    "Chicago, IL",
    "Los Angeles, CA",
    "Denver, CO",
    "Remote",
    "Hybrid",
  ]

  const salaries = [
    "$80,000 - $120,000",
    "$100,000 - $150,000",
    "$120,000 - $180,000",
    "$90,000 - $130,000",
    "$110,000 - $160,000",
    "Competitive",
    "$85,000 - $125,000",
    "$95,000 - $140,000",
  ]

  return Array.from({ length: count }, (_, i) => ({
    id: `${siteName.toLowerCase()}-${i + 1}`,
    title: `${jobTitles[Math.floor(Math.random() * jobTitles.length)]} - ${query}`,
    description: `We are looking for a talented professional to join our team. This role involves working with cutting-edge technologies and collaborating with cross-functional teams to deliver exceptional results. The ideal candidate will have strong problem-solving skills and experience with modern development practices.`,
    link: `https://${domain}/job/${Math.random().toString(36).substring(7)}`,
    company: companies[Math.floor(Math.random() * companies.length)],
    location: locations[Math.floor(Math.random() * locations.length)],
    salary: Math.random() > 0.3 ? salaries[Math.floor(Math.random() * salaries.length)] : undefined,
  }))
}

export async function POST(request: NextRequest) {
  try {
    const body: SearchRequest = await request.json()
    const { sites, query } = body

    if (!sites || sites.length === 0) {
      return NextResponse.json({ error: "No sites selected" }, { status: 400 })
    }

    if (!query || query.trim() === "") {
      return NextResponse.json({ error: "No search query provided" }, { status: 400 })
    }

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1500))

    const siteMap = {
      indeed: { name: "Indeed", domain: "indeed.com" },
      linkedin: { name: "LinkedIn", domain: "linkedin.com" },
      glassdoor: { name: "Glassdoor", domain: "glassdoor.com" },
      monster: { name: "Monster", domain: "monster.com" },
      ziprecruiter: { name: "ZipRecruiter", domain: "ziprecruiter.com" },
    }

    const results = sites
      .map((siteId) => {
        const site = siteMap[siteId as keyof typeof siteMap]
        if (!site) return null

        const jobCount = Math.floor(Math.random() * 8) + 3 // 3-10 jobs per site
        const jobs = generateMockJobs(site.name, site.domain, query, jobCount)

        return {
          id: siteId,
          name: site.name,
          domain: site.domain,
          jobs,
        }
      })
      .filter(Boolean)

    return NextResponse.json({
      success: true,
      results,
      totalJobs: results.reduce((sum, site) => sum + (site?.jobs.length || 0), 0),
    })
  } catch (error) {
    console.error("Search API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
