const express = require('express');
const bodyParser = require('body-parser');
const { Op, Sequelize } = require('sequelize');
const { Alert, Event } = require('./models');
const app = express();
const path = require('path');
const PORT = 3000;

const expressLayouts = require('express-ejs-layouts');

// Set up EJS templating
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to pass common variables to all templates
app.use((req, res, next) => {
  res.locals.query = req.query;
  res.locals.currentTab = '';
  next();
});

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

// Grouping alerts within 30 seconds with the same details, returning distinct groups
function groupAlerts(alerts) {
  const groupedAlerts = [];
  const groupedMap = {};

  alerts.forEach(alert => {
    const key = `${alert.alertId}-${alert.source_ip}-${alert.destination_ip}-${alert.protocol}-${alert.message}`;
    const timestamp = new Date(alert.timestamp);

    if (groupedMap[key] && (timestamp - new Date(groupedMap[key].timestamp) < 30 * 1000)) {
      groupedMap[key].count += 1;
      groupedMap[key].timestamp = alert.timestamp;
    } else {
      alert.count = 1;
      groupedMap[key] = alert;
      groupedAlerts.push(alert);
    }
  });

  return groupedAlerts;
}

// Homepage redirect to /alerts
app.get('/', (req, res) => {
  res.redirect('/alerts');
});

// Alerts Page with Grouping and Pagination
app.get('/alerts', async (req, res) => {
  let { page, limit, sortBy, order, startTime, endTime, timeFrame, search, severity, source_ip, destination_ip, protocol } = req.query;

  page = parseInt(page) || 1;
  limit = parseInt(limit) || 20;
  sortBy = sortBy || 'timestamp';
  order = order || 'DESC';

  const whereClause = {};

  // Apply filters based on user input
  if (severity) whereClause.severity = severity;
  if (source_ip) whereClause.source_ip = { [Op.iLike]: `%${source_ip}%` };
  if (destination_ip) whereClause.destination_ip = { [Op.iLike]: `%${destination_ip}%` };
  if (protocol) whereClause.protocol = protocol;

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

  const alerts = await Alert.findAll({
    where: whereClause,
    order: [[sortBy, order]],
    limit: limit,
    offset: (page - 1) * limit,
  });

  const groupedAlerts = groupAlerts(alerts);

  const totalAlerts = await Alert.count({ where: whereClause });
  const totalPages = Math.ceil(totalAlerts / limit);

  res.render('alerts', { alerts: groupedAlerts, page, totalPages, query: req.query, currentTab: 'alerts' });
});

// Inbox Page (status: new)
app.get('/inbox', async (req, res) => {
  const statusFilter = { status: 'new' };
  await getAlertsPage(req, res, 'inbox', statusFilter);
});

// Escalated Page (status: escalated)
app.get('/escalated', async (req, res) => {
  const statusFilter = { status: 'escalated' };
  await getAlertsPage(req, res, 'escalated', statusFilter);
});

// General function to handle alerts pages
async function getAlertsPage(req, res, tabName, statusFilter) {
  let { page, limit, sortBy, order, startTime, endTime, timeFrame, search, severity, source_ip, destination_ip, protocol } = req.query;

  page = parseInt(page) || 1;
  limit = parseInt(limit) || 20;
  sortBy = sortBy || 'timestamp';
  order = order || 'DESC';

  const whereClause = { ...statusFilter };

  // Apply filters based on user input
  if (severity) whereClause.severity = severity;
  if (source_ip) whereClause.source_ip = { [Op.iLike]: `%${source_ip}%` };
  if (destination_ip) whereClause.destination_ip = { [Op.iLike]: `%${destination_ip}%` };
  if (protocol) whereClause.protocol = protocol;

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

  const alerts = await Alert.findAll({
    where: whereClause,
    order: [[sortBy, order]],
    limit: limit,
    offset: (page - 1) * limit,
  });

  const totalAlerts = await Alert.count({ where: whereClause });
  const totalPages = Math.ceil(totalAlerts / limit);

  res.render('alerts', { alerts, page, totalPages, query: req.query, currentTab: tabName });
}

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
      { eventType: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const events = await Event.findAll({
    where: whereClause,
    order: [[sortBy, order]],
    limit: limit,
    offset: (page - 1) * limit,
  });

  const totalEvents = await Event.count({ where: whereClause });
  const totalPages = Math.ceil(totalEvents / limit);

  res.render('events', { events, page, totalPages, query: req.query, currentTab: 'events' });
});

// Detailed View for Alerts (includes packet info)
app.get('/alerts/:id', async (req, res) => {
  const alert = await Alert.findByPk(req.params.id);

  // Decode packetData if it exists and is in Base64
  if (alert.packetData) {
    try {
      const decodedPacketData = Buffer.from(alert.packetData, 'base64').toString('utf-8');
      alert.formattedPacketData = decodedPacketData;
    } catch (e) {
      console.error("Failed to decode packet data:", e);
      alert.formattedPacketData = "Decoding error";
    }
  } else {
    alert.formattedPacketData = "N/A";
  }

  res.render('alertDetails', { alert });
});


// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
