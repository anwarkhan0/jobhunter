const express = require('express');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const cors = require('cors'); // <-- Add this line

const app = express();
app.use(cors()); // <-- Add this line
app.use(express.json());

const jobs = {}; // In-memory job storage

// Function to dynamically load the appropriate scraper based on the website URL
const getScraperForWebsite = (url) => {
  if (url.includes('expatriates.com')) {
    return require('./scrapers/expatriates');
  }
  if (url.includes('mourjan.com')) {
    return require('./scrapers/mourjan');
  }
  throw new Error('No scraper found for this website');
};

// Endpoint to accept website URLs and scrape them
app.post('/scrape', async (req, res) => {
  const { websites, time } = req.body;
  const jobId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
  jobs[jobId] = { status: 'pending', result: null };

  // Start scraping in the background
  (async () => {
    const scrapedData = [];
    for (const website of websites) {
      try {
        console.log(`Scraping website: ${website}`);
        
        // Dynamically load the correct scraper based on the website
        const scraper = getScraperForWebsite(website);
       
        
        const data = await scraper(time);
        scrapedData.push({ website, data });
        jobs[jobId].result = scrapedData.slice(); // <-- update partial result
        jobs[jobId].progress = scrapedData.length;

      } catch (error) {
        console.error(`Error scraping ${website}:`, error);
        scrapedData.push({ website, error: error.message });
      }
    }
    jobs[jobId].status = 'done';
  })();

  res.json({ jobId });
});

// Endpoint to get results
app.get('/results/:jobId', (req, res) => {
  const job = jobs[req.params.jobId];
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.status === 'pending') return res.json({ status: 'pending' });
  res.json({ status: 'done', result: job.result });
});

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
