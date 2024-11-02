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

// Grouping function for alerts
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

// Main Alerts Page
app.get('/alerts', async (req, res) => {
  await getAlertsPage(req, res, 'alerts');
});

// Inbox Page (status: new)
app.get('/inbox', async (req, res) => {
  await getAlertsPage(req, res, 'inbox', { status: 'new' });
});

// Escalated Page (status: escalated)
app.get('/escalated', async (req, res) => {
  await getAlertsPage(req, res, 'escalated', { status: 'escalated' });
});

// Common handler for alerts pages with filtering, grouping, and pagination
async function getAlertsPage(req, res, tabName, additionalFilters = {}) {
  let { page, limit, sortBy, order, startTime, endTime, timeFrame, search, severity, source_ip, destination_ip, protocol } = req.query;

  page = parseInt(page) || 1;
  limit = parseInt(limit) || 20;
  sortBy = sortBy || 'timestamp';
  order = order || 'DESC';

  const whereClause = { ...additionalFilters };

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

  if (search) {
    whereClause[Op.or] = [
      { source_ip: { [Op.iLike]: `%${search}%` } },
      { destination_ip: { [Op.iLike]: `%${search}%` } },
      { message: { [Op.iLike]: `%${search}%` } },
    ];
  }

  // Fetch all matching alerts and apply grouping before pagination
  const allAlerts = await Alert.findAll({
    where: whereClause,
    order: [[sortBy, order]],
  });

  // Group alerts
  const groupedAlerts = groupAlerts(allAlerts);

  // Paginate after grouping
  const totalGrouped = groupedAlerts.length;
  const totalPages = Math.ceil(totalGrouped / limit);
  const paginatedAlerts = groupedAlerts.slice((page - 1) * limit, page * limit);

  res.render('alerts', { alerts: paginatedAlerts, page, totalPages, query: req.query, currentTab: tabName });
}

app.post('/alerts/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const currentTab = req.query.currentTab || 'alerts';  // Read currentTab from query

  try {
    const alert = await Alert.findByPk(id);
    if (!alert) {
      return res.status(404).send("Alert not found");
    }

    const groupingCriteria = {
      alertId: alert.alertId,
      source_ip: alert.source_ip,
      destination_ip: alert.destination_ip,
      protocol: alert.protocol,
      message: alert.message,
      status: alert.status
    };

    // Update the status for all alerts in the group
    await Alert.update({ status }, { where: groupingCriteria });

    // Redirect back to the appropriate tab
    res.redirect(`/${currentTab}`);
  } catch (error) {
    console.error("Failed to update grouped alert status:", error);
    res.status(500).send("An error occurred while updating alert status.");
  }
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


function formatPacketData(packetData) {
  // Check for ASCII readability
  const isAsciiReadable = /^[\x20-\x7E\s]*$/.test(packetData);

  if (isAsciiReadable) {
    // If readable ASCII, return as-is with preserved newlines
    return packetData;
  } else {
    // Otherwise, encode as hexadecimal
    return Buffer.from(packetData, 'base64').toString('hex');
  }
}


// Detailed View for Alerts (includes packet info and pagination)
app.get('/alerts/:id', async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const limit = 1; // Set limit to 1 to view one alert at a time
    const offset = (parseInt(page) - 1) * limit;

    // Fetch the primary alert details by ID
    const alert = await Alert.findByPk(req.params.id);
    if (!alert) {
      return res.status(404).send("Alert not found");
    }

    // Retrieve one alert in the group based on pagination
    const alertsInGroup = await Alert.findAll({
      where: {
        alertId: alert.alertId,
        source_ip: alert.source_ip,
        destination_ip: alert.destination_ip,
        protocol: alert.protocol,
        message: alert.message,
      },
      order: [['timestamp', 'DESC']],
      limit,
      offset,
    });

    // Apply formatting to packet data for the alert being rendered
    if (alertsInGroup[0]) {
      alertsInGroup[0].formattedPacketData = formatPacketData(alertsInGroup[0].packetData);
    }

    // Calculate total pages for pagination
    const totalAlerts = await Alert.count({
      where: {
        alertId: alert.alertId,
        source_ip: alert.source_ip,
        destination_ip: alert.destination_ip,
        protocol: alert.protocol,
        message: alert.message,
      },
    });
    const totalPages = Math.ceil(totalAlerts / limit);

    // Render the alert details, passing formatted packet data
    res.render('alertDetails', {
      alert: alertsInGroup[0], // Pass only one alert at a time with formatted data
      currentPage: parseInt(page),
      totalPages,
      currentTab: req.query.currentTab || 'alerts',
    });
  } catch (error) {
    console.error("Error fetching alert details:", error);
    res.status(500).send("An error occurred while fetching alert details.");
  }
});



// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
