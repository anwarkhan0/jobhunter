const mongoose = require('mongoose');

const websiteSchema = new mongoose.Schema({
  url: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String },
});

const Website = mongoose.model('Website', websiteSchema);

module.exports = Website;
