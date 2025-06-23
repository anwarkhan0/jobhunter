import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { results, query } = await request.json()

    // In a real application, you would use a PDF generation library like puppeteer, jsPDF, or PDFKit
    // For this demo, we'll create a simple HTML-to-PDF conversion simulation

    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Job Search Results</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
          h2 { color: #007bff; margin-top: 30px; }
          .job { margin: 15px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
          .job-title { font-weight: bold; font-size: 16px; color: #333; }
          .job-company { color: #666; margin: 5px 0; }
          .job-location { color: #888; font-size: 14px; }
          .job-salary { color: #28a745; font-weight: bold; }
          .job-description { margin: 10px 0; line-height: 1.4; }
          .job-link { color: #007bff; text-decoration: none; }
        </style>
      </head>
      <body>
        <h1>Job Search Results for "${query}"</h1>
        <p>Generated on: ${new Date().toLocaleDateString()}</p>
    `

    results.forEach((site: any) => {
      htmlContent += `
        <h2>${site.name} (${site.domain}) - ${site.jobs.length} jobs</h2>
      `

      site.jobs.forEach((job: any) => {
        htmlContent += `
          <div class="job">
            <div class="job-title">${job.title}</div>
            <div class="job-company">${job.company}</div>
            <div class="job-location">${job.location}</div>
            ${job.salary ? `<div class="job-salary">${job.salary}</div>` : ""}
            <div class="job-description">${job.description}</div>
            <a href="${job.link}" class="job-link">View Job</a>
          </div>
        `
      })
    })

    htmlContent += `
      </body>
      </html>
    `

    // In a real implementation, you would convert HTML to PDF here
    // For this demo, we'll return the HTML as a blob that browsers can handle
    const buffer = Buffer.from(htmlContent, "utf-8")

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="job-search-results-${new Date().toISOString().split("T")[0]}.pdf"`,
      },
    })
  } catch (error) {
    console.error("PDF export error:", error)
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 })
  }
}
