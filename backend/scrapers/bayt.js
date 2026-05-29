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
// function isWithinTimeframe(postingTimeStr, time) {
//   if (!time) return true;
//   const now = new Date();
//   if (!postingTimeStr) return false;
//   let postDate = null;
//   const match = postingTimeStr.match(/(\d+)\s*(minute|hour|day|week|month|year)s?\s+ago/i);
//   if (match) {
//     const value = parseInt(match[1], 10);
//     const unit = match[2].toLowerCase();
//     switch (unit) {
//       case 'minute':
//         postDate = new Date(now.getTime() - value * 60 * 1000);
//         break;
//       case 'hour':
//         postDate = new Date(now.getTime() - value * 60 * 60 * 1000);
//         break;
//       case 'day':
//         postDate = new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
//         break;
//       case 'week':
//         postDate = new Date(now.getTime() - value * 7 * 24 * 60 * 60 * 1000);
//         break;
//       case 'month': {
//         const d = new Date(now);
//         d.setMonth(now.getMonth() - value);
//         postDate = d;
//         break;
//       }
//       case 'year': {
//         const d = new Date(now);
//         d.setFullYear(now.getFullYear() - value);
//         postDate = d;
//         break;
//       }
//       default:
//         postDate = null;
//     }
//   } else if (/yesterday/i.test(postingTimeStr)) {
//     postDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
//   }
//   if (!postDate) return false;
//   if (time === "24h") {
//     return (now - postDate) <= 24 * 60 * 60 * 1000;
//   }
//   if (time === "7d") {
//     return (now - postDate) <= 7 * 24 * 60 * 60 * 1000;
//   }
//   return true;
// }

module.exports = async (time) => {
  const browser = await chromium.launch({ headless: false });
  let allJobs = [];
  let shouldStop = false;
  let lastFirstJobId = null;

  for (let pageNo = 1; pageNo <= 100 && !shouldStop; pageNo++) {
    let url;
    if (time === "24h") {
      url = `https://www.bayt.com/en/saudi-arabia/jobs/?filters%5Bjb_last_modification_date_interval%5D%5B%5D=3&page=${pageNo}`;
    } else if (time === "7d") {
      url = `https://www.bayt.com/en/saudi-arabia/jobs/?filters%5Bjb_last_modification_date_interval%5D%5B%5D=2&page=${pageNo}`;
    } else {
      url = `https://www.bayt.com/en/saudi-arabia/jobs/?page=${pageNo}`;
    }

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
      break;
    }

    const jobs = await page.evaluate(() => {
      const jobItems = [];
      const jobNodes = document.querySelectorAll('li[data-js-job]');
      jobNodes.forEach(item => {
        const titleAnchor = item.querySelector('h2 a');
        const title = titleAnchor ? titleAnchor.innerText.trim() : '';
        let link = titleAnchor ? titleAnchor.getAttribute('href') : '';
        if (link && !link.startsWith('http')) {
          link = 'https://www.bayt.com' + link;
        }
        const companySpan = item.querySelector('.t-nowrap .t-default');
        const company = companySpan ? companySpan.innerText.trim() : '';
        const locationDiv = item.querySelector('.t-nowrap .t-mute.t-small');
        const location = locationDiv ? locationDiv.innerText.trim() : '';
        const descDiv = item.querySelector('.jb-descr');
        const description = descDiv ? descDiv.innerText.trim() : '';
        let salary = '';
        const salaryDt = item.querySelector('.jb-label-salary');
        if (salaryDt) {
          salary = salaryDt.innerText.trim();
        }
        let postingTime = '';
        const dateSpan = item.querySelector('.jb-date span');
        if (dateSpan) {
          postingTime = dateSpan.innerText.trim();
        }
        // Use link as unique id (or title+company+location as fallback)
        const id = link || (title + company + location);
        jobItems.push({
          id,
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

    // Stop if no jobs found
    if (jobs.length === 0) {
      shouldStop = true;
      break;
    }

    // Detect duplicate page (redirected to last page)
    const firstJobId = jobs[0] ? jobs[0].id : null;
    if (lastFirstJobId && firstJobId === lastFirstJobId) {
      // We're scraping the same page again, stop!
      shouldStop = true;
      break;
    }
    lastFirstJobId = firstJobId;

    allJobs.push(...jobs);

    // Filter jobs by time and stop if any job is older than the filter
    // for (const job of jobs) {
    //   if (isWithinTimeframe(job.postingTime, time)) {
    //     allJobs.push(job);
    //   } else {
    //     shouldStop = true;
    //     break;
    //   }
    // }

    console.log(`Page ${pageNo}: Collected ${allJobs.length} jobs so far`);

    await context.close();
    await new Promise(r => setTimeout(r, randomDelay(2000, 5000)));
  }

  await browser.close();
  return allJobs;
}
