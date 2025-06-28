const { chromium } = require('playwright');

const USER_AGENTS = [
  // Add more user agents as needed
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
];

function randomDelay(min = 2000, max = 6000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function parseGulfTalentTime(str) {
  if (!str) return null;
  const now = new Date();
  // "28 Jun"
  const dateMatch = str.match(/^(\d{1,2})\s+([A-Za-z]{3})$/);
  if (dateMatch) {
    const day = parseInt(dateMatch[1], 10);
    const monthStr = dateMatch[2];
    const month = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].indexOf(monthStr);
    if (month !== -1) {
      const year = now.getMonth() < month ? now.getFullYear() - 1 : now.getFullYear();
      return new Date(year, month, day);
    }
  }
  return null;
}

// Helper to check if a date is within the time filter
function isWithinTimeframe(postingTimeStr, time) {
  if (!time) return true;
  const postDate = parseGulfTalentTime(postingTimeStr);
  if (!postDate) return false;
  const now = new Date();
  if (time === "24h") {
    return (now - postDate) <= 24 * 60 * 60 * 1000;
  }
  if (time === "7d") {
    return (now - postDate) <= 7 * 24 * 60 * 60 * 1000;
  }
  return true;
}

module.exports = async (time) => {
  const browser = await chromium.launch({ headless: false });
  let allJobs = [];

  for (let pageNo = 1; pageNo <= 1; pageNo++) {
    const url = `https://www.gulftalent.com/saudi-arabia/jobs/${pageNo}`;

    // Set a random user agent for each request
    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    const context = await browser.newContext({
      userAgent,
      locale: 'en-US'
    });
    const page = await context.newPage();

    // Set some common headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    });

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(randomDelay(2000, 5000));
      await page.waitForSelector('tr.content-visibility-auto', { timeout: 10000 }); // <-- correct selector
    } catch (e) {
      console.error(`Failed to load or parse page ${pageNo}: ${e.message}`);
      await context.close();
      continue;
    }

    const jobs = await page.evaluate(() => {
      const jobItems = [];
      const rows = document.querySelectorAll('tr.content-visibility-auto');
      rows.forEach(row => {
        // Title and link
        const titleAnchor = row.querySelector('h2.title a');
        const title = titleAnchor ? titleAnchor.innerText.trim() : '';
        let link = titleAnchor ? titleAnchor.getAttribute('href') : '';
        if (link && !link.startsWith('http')) {
          link = 'https://www.gulftalent.com' + link;
        }

        // Company
        const companyAnchor = row.querySelector('a.text-base.text-muted');
        const company = companyAnchor ? companyAnchor.innerText.trim() : '';

        // Location
        const locationSpan = row.querySelector('td.col-sm-6 span[title]');
        const location = locationSpan ? locationSpan.innerText.trim() : '';

        // Date (e.g. "28 Jun")
        const dateTd = row.querySelector('td.col-sm-4');
        const postingTime = dateTd ? dateTd.innerText.trim() : '';

        // Logo (optional)
        const logoImg = row.querySelector('td.text-center.col-sm-5 img');
        const logo = logoImg ? logoImg.getAttribute('src') : '';

        jobItems.push({
          title,
          company,
          location,
          postingTime,
          link,
          logo,
          description: '', // Not available in the list view
        });
      });
      return jobItems;
    });

    // Filter jobs by time
    const filteredJobs = jobs.filter(job => isWithinTimeframe(job.postingTime, time));

    allJobs = allJobs.concat(filteredJobs);
    console.log(`Page ${pageNo}: Collected ${filteredJobs.length} jobs after filtering`);

    await context.close();
    await new Promise(r => setTimeout(r, randomDelay(2000, 5000)));
  }

  await browser.close();
  return allJobs;
}
