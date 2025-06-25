const { chromium } = require('playwright');

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
];

function randomDelay(min = 2000, max = 6000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper to check if a date is within the time filter
function isWithinTimeframe(postingTimeStr, time) {
  if (!time) return true;
  // Parse "22 hours ago", "Yesterday", etc.
  const now = new Date();
  if (!postingTimeStr) return false;
  let postDate = null;
  const match = postingTimeStr.match(/(\d+)\s*(minute|hour|day|week|month|year)s?\s+ago/i);
  if (match) {
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    switch (unit) {
      case 'minute': postDate = new Date(now.getTime() - value * 60 * 1000); break;
      case 'hour': postDate = new Date(now.getTime() - value * 60 * 60 * 1000); break;
      case 'day': postDate = new Date(now.getTime() - value * 24 * 60 * 60 * 1000); break;
      case 'week': postDate = new Date(now.getTime() - value * 7 * 24 * 60 * 60 * 1000); break;
      case 'month': postDate = new Date(now.setMonth(now.getMonth() - value)); break;
      case 'year': postDate = new Date(now.setFullYear(now.getFullYear() - value)); break;
      default: postDate = null;
    }
  } else if (/yesterday/i.test(postingTimeStr)) {
    postDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
  if (!postDate) return false;
  if (time === "24h") {
    return (now - postDate) <= 24 * 60 * 60 * 1000;
  }
  if (time === "7d") {
    return (now - postDate) <= 7 * 24 * 60 * 60 * 1000;
  }
  return true;
}

module.exports = async (time) => {
  const browser = await chromium.launch({ headless: true });
  let allJobs = [];

  for (let pageNo = 1; pageNo <= 1; pageNo++) {
    const url = `https://www.bayt.com/en/saudi-arabia/jobs/?page=${pageNo}`;

    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    const context = await browser.newContext({
      userAgent,
      locale: 'en-US'
    });
    const page = await context.newPage();

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    });

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(randomDelay(2000, 5000));
      await page.waitForSelector('li[data-js-job]', { timeout: 10000 });
    } catch (e) {
      console.error(`Failed to load or parse page ${pageNo}: ${e.message}`);
      await context.close();
      continue;
    }

    const jobs = await page.evaluate(() => {
      const jobItems = [];
      const jobNodes = document.querySelectorAll('li[data-js-job]');
      jobNodes.forEach(item => {
        // Title and link
        const titleAnchor = item.querySelector('h2 a');
        const title = titleAnchor ? titleAnchor.innerText.trim() : '';
        let link = titleAnchor ? titleAnchor.getAttribute('href') : '';
        if (link && !link.startsWith('http')) {
          link = 'https://www.bayt.com' + link;
        }

        // Company and location
        const companySpan = item.querySelector('.t-nowrap .t-default');
        const company = companySpan ? companySpan.innerText.trim() : '';
        const locationDiv = item.querySelector('.t-nowrap .t-mute.t-small');
        const location = locationDiv ? locationDiv.innerText.trim() : '';

        // Description
        const descDiv = item.querySelector('.jb-descr');
        const description = descDiv ? descDiv.innerText.trim() : '';

        // Salary
        let salary = '';
        const salaryDt = item.querySelector('.jb-label-salary');
        if (salaryDt) {
          salary = salaryDt.innerText.trim();
        }

        // Posting time
        let postingTime = '';
        const dateSpan = item.querySelector('.jb-date span');
        if (dateSpan) {
          postingTime = dateSpan.innerText.trim();
        }

        jobItems.push({
          title,
          company,
          location,
          description,
          salary,
          postingTime,
          link
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
