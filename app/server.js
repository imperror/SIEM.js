const express = require('express');
const bodyParser = require('body-parser');
const { Op, Sequelize } = require('sequelize');
const { Alert } = require('./models');
const app = express();
const PORT = 3000;

// Set up EJS templating
app.set('view engine', 'ejs');

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));

// Start the log parser
require('./logParser');

// Time frame options
const timeFrames = {
  '15min': 15 * 60 * 1000,
  '30min': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '3h': 3 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '1w': 7 * 24 * 60 * 60 * 1000
};

// Homepage redirect to /alerts
app.get('/', (req, res) => {
  res.redirect('/alerts');
});

// Alerts Page
app.get('/alerts', async (req, res) => {
  let { page, limit, sortBy, order, startTime, endTime, timeFrame, search } = req.query;

  page = parseInt(page) || 1;
  limit = parseInt(limit) || 20;
  sortBy = sortBy || 'timestamp';
  order = order || 'DESC';

  const whereClause = {};

  // Time frame filter
  if (timeFrame && timeFrames[timeFrame]) {
    const now = new Date();
    const start = new Date(now - timeFrames[timeFrame]);
    whereClause.timestamp = { [Op.gte]: start };
  } else if (startTime && endTime) {
    whereClause.timestamp = {
      [Op.between]: [new Date(startTime), new Date(endTime)],
    };
  }

  // Search filter
  if (search) {
    whereClause[Op.or] = [
      { source_ip: { [Op.iLike]: `%${search}%` } },
      { destination_ip: { [Op.iLike]: `%${search}%` } },
      { message: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const totalAlerts = await Alert.count({ where: whereClause });
  const totalPages = Math.ceil(totalAlerts / limit);

  const alerts = await Alert.findAll({
    where: whereClause,
    order: [[sortBy, order]],
    limit: limit,
    offset: (page - 1) * limit,
  });

  res.render('alerts', { alerts, page, totalPages, query: req.query, currentTab: 'alerts' });
});

// Inbox Page (status: new)
app.get('/inbox', async (req, res) => {
  let { page, limit, sortBy, order, startTime, endTime, timeFrame, search } = req.query;

  page = parseInt(page) || 1;
  limit = parseInt(limit) || 20;
  sortBy = sortBy || 'timestamp';
  order = order || 'DESC';

  const whereClause = { status: 'new' };

  // Time frame filter
  if (timeFrame && timeFrames[timeFrame]) {
    const now = new Date();
    const start = new Date(now - timeFrames[timeFrame]);
    whereClause.timestamp = { [Op.gte]: start };
  } else if (startTime && endTime) {
    whereClause.timestamp = {
      [Op.between]: [new Date(startTime), new Date(endTime)],
    };
  }

  // Search filter
  if (search) {
    whereClause[Op.or] = [
      { source_ip: { [Op.iLike]: `%${search}%` } },
      { destination_ip: { [Op.iLike]: `%${search}%` } },
      { message: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const totalAlerts = await Alert.count({ where: whereClause });
  const totalPages = Math.ceil(totalAlerts / limit);

  const alerts = await Alert.findAll({
    where: whereClause,
    order: [[sortBy, order]],
    limit: limit,
    offset: (page - 1) * limit,
  });

  res.render('alerts', { alerts, page, totalPages, query: req.query, currentTab: 'inbox' });
});

// Escalated Page (status: escalated)
app.get('/escalated', async (req, res) => {
  let { page, limit, sortBy, order, startTime, endTime, timeFrame, search } = req.query;

  page = parseInt(page) || 1;
  limit = parseInt(limit) || 20;
  sortBy = sortBy || 'timestamp';
  order = order || 'DESC';

  const whereClause = { status: 'escalated' };

  // Time frame filter
  if (timeFrame && timeFrames[timeFrame]) {
    const now = new Date();
    const start = new Date(now - timeFrames[timeFrame]);
    whereClause.timestamp = { [Op.gte]: start };
  } else if (startTime && endTime) {
    whereClause.timestamp = {
      [Op.between]: [new Date(startTime), new Date(endTime)],
    };
  }

  // Search filter
  if (search) {
    whereClause[Op.or] = [
      { source_ip: { [Op.iLike]: `%${search}%` } },
      { destination_ip: { [Op.iLike]: `%${search}%` } },
      { message: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const totalAlerts = await Alert.count({ where: whereClause });
  const totalPages = Math.ceil(totalAlerts / limit);

  const alerts = await Alert.findAll({
    where: whereClause,
    order: [[sortBy, order]],
    limit: limit,
    offset: (page - 1) * limit,
  });

  res.render('alerts', { alerts, page, totalPages, query: req.query, currentTab: 'escalated' });
});

// Change alert status (acknowledge or escalate)
app.post('/alerts/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  await Alert.update({ status }, { where: { id } });
  res.redirect('back');
});

// Stats Page
app.get('/stats', async (req, res) => {
  const totalAlerts = await Alert.count();
  const severityCounts = await Alert.findAll({
    attributes: ['severity', [Sequelize.fn('COUNT', Sequelize.col('severity')), 'count']],
    group: ['severity'],
  });

  res.render('stats', { totalAlerts, severityCounts, currentTab: 'stats' });
});

// Events Page
app.get('/events', async (req, res) => {
  res.render('events', { currentTab: 'events' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
