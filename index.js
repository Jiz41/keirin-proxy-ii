const express = require('express');
const { getKaisai } = require('./kaisai');
const { scrapeRace } = require('./scraper');

const app = express();
const port = process.env.PORT || 3000;

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.get('/', (req, res) => res.send('keirin-proxy-ii ok'));

app.get('/kaisai', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date is required' });
  try {
    res.json(await getKaisai(date));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/race', async (req, res) => {
  const { raceId } = req.query;
  if (!raceId) return res.status(400).json({ error: 'raceId is required' });
  try {
    res.json(await scrapeRace(raceId));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(port, () => {
  console.log(`keirin-proxy-ii listening at http://localhost:${port}`);
});
