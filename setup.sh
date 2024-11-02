#!/bin/bash

# Create the project directory
mkdir -p siem-project
cd siem-project

# Create docker-compose.yml
cat > docker-compose.yml <<EOL
version: '3'

services:
  suricata:
    image: jasonish/suricata:6.0.15-arm32v6
    container_name: suricata
    privileged: true
    network_mode: "host"
    volumes:
      - ./suricata/config:/etc/suricata
      - ./suricata/logs:/var/log/suricata
    cap_add:
      - NET_ADMIN
      - SYS_NICE
    command: ["suricata", "-c", "/etc/suricata/suricata.yaml", "-i", "wlan0"]
    restart: on-failure

  postgres:
    image: postgres:13-alpine
    container_name: postgres
    environment:
      - POSTGRES_USER=siemuser
      - POSTGRES_PASSWORD=siempass
      - POSTGRES_DB=siemdb
    volumes:
      - ./postgres/data:/var/lib/postgresql/data
    restart: always

  app:
    build: ./app
    container_name: siem-app
    environment:
      - DATABASE_URL=postgres://siemuser:siempass@postgres:5432/siemdb
    volumes:
      - ./app:/usr/src/app
    depends_on:
      - postgres
    ports:
      - "3000:3000"
    restart: on-failure
EOL

# Create suricata directories and suricata.yaml
mkdir -p suricata/config suricata/logs
cat > suricata/config/suricata.yaml <<EOL
%YAML 1.1
---
# Default Suricata configuration

vars:
  # ...

outputs:
  - eve-log:
      enabled: yes
      filetype: regular
      filename: /var/log/suricata/eve.json
      types:
        - alert
        - anomaly
        - http
        - dns
        - tls
        - fileinfo
        - ssh

# ...
EOL

# Create postgres data directory
mkdir -p postgres/data

# Create app directories
mkdir -p app/config app/migrations app/models app/views app/public/css

# Create app/Dockerfile
cat > app/Dockerfile <<EOL
FROM node:14-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD [ "node", "server.js" ]
EOL

# Create app/package.json
cat > app/package.json <<EOL
{
  "name": "siem-app",
  "version": "1.0.0",
  "description": "Custom SIEM application",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "migrate": "sequelize db:migrate",
    "seed": "sequelize db:seed:all"
  },
  "dependencies": {
    "body-parser": "^1.19.0",
    "chokidar": "^3.5.3",
    "ejs": "^3.1.6",
    "express": "^4.17.1",
    "pg": "^8.6.0",
    "pg-hstore": "^2.3.3",
    "sequelize": "^6.6.5"
  },
  "devDependencies": {
    "nodemon": "^2.0.7",
    "sequelize-cli": "^6.2.0"
  }
}
EOL

# Create app/config/config.json
cat > app/config/config.json <<EOL
{
  "development": {
    "username": "siemuser",
    "password": "siempass",
    "database": "siemdb",
    "host": "postgres",
    "dialect": "postgres"
  }
}
EOL

# Create migration file
cat > app/migrations/20211001000000-create-alert.js <<EOL
'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('Alerts', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      alertId: {
        type: Sequelize.STRING
      },
      timestamp: {
        type: Sequelize.DATE
      },
      severity: {
        type: Sequelize.STRING
      },
      source_ip: {
        type: Sequelize.STRING
      },
      destination_ip: {
        type: Sequelize.STRING
      },
      protocol: {
        type: Sequelize.STRING
      },
      message: {
        type: Sequelize.STRING
      },
      status: {
        type: Sequelize.STRING,
        defaultValue: 'new'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()')
      }
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('Alerts');
  }
};
EOL

# Create app/models/alert.js
cat > app/models/alert.js <<EOL
'use strict';
module.exports = (sequelize, DataTypes) => {
  const Alert = sequelize.define('Alert', {
    alertId: DataTypes.STRING,
    timestamp: DataTypes.DATE,
    severity: DataTypes.STRING,
    source_ip: DataTypes.STRING,
    destination_ip: DataTypes.STRING,
    protocol: DataTypes.STRING,
    message: DataTypes.STRING,
    status: DataTypes.STRING
  }, {});
  Alert.associate = function(models) {
    // associations can be defined here
  };
  return Alert;
};
EOL

# Create app/models/index.js
cat > app/models/index.js <<EOL
'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const basename = path.basename(__filename);
const env = 'development';
const config = require(__dirname + '/../config/config.json')[env];
const db = {};

let sequelize;
sequelize = new Sequelize(config.database, config.username, config.password, config);

fs
  .readdirSync(__dirname)
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js' &&
      file.indexOf('.test.js') === -1
    );
  })
  .forEach(file => {
    const model = require(path.join(__dirname, file))(
      sequelize,
      Sequelize.DataTypes
    );
    db[model.name] = model;
  });

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
EOL

# Create app/views/layout.ejs
cat > app/views/layout.ejs <<EOL
<!DOCTYPE html>
<html>
<head>
  <title>SIEM Application</title>
  <link rel="stylesheet" href="/css/styles.css">
</head>
<body>
  <header>
    <nav>
      <ul>
        <li><a href="/inbox" class="<%= currentTab === 'inbox' ? 'active' : '' %>">Inbox</a></li>
        <li><a href="/escalated" class="<%= currentTab === 'escalated' ? 'active' : '' %>">Escalated</a></li>
        <li><a href="/alerts" class="<%= currentTab === 'alerts' ? 'active' : '' %>">Alerts</a></li>
        <li><a href="/stats" class="<%= currentTab === 'stats' ? 'active' : '' %>">Stats</a></li>
        <li><a href="/events" class="<%= currentTab === 'events' ? 'active' : '' %>">Events</a></li>
      </ul>
    </nav>
    <form method="get" action="">
      <label for="timeFrame">Time Frame:</label>
      <select name="timeFrame" id="timeFrame">
        <option value="">--Select--</option>
        <option value="15min" <%= query.timeFrame === '15min' ? 'selected' : '' %>>Last 15 minutes</option>
        <option value="30min" <%= query.timeFrame === '30min' ? 'selected' : '' %>>Last 30 minutes</option>
        <option value="1h" <%= query.timeFrame === '1h' ? 'selected' : '' %>>Last 1 hour</option>
        <option value="3h" <%= query.timeFrame === '3h' ? 'selected' : '' %>>Last 3 hours</option>
        <option value="12h" <%= query.timeFrame === '12h' ? 'selected' : '' %>>Last 12 hours</option>
        <option value="1d" <%= query.timeFrame === '1d' ? 'selected' : '' %>>Last 1 day</option>
        <option value="1w" <%= query.timeFrame === '1w' ? 'selected' : '' %>>Last 1 week</option>
      </select>
      <input type="text" name="search" placeholder="Search..." value="<%= query.search || '' %>">
      <button type="submit">Apply</button>
    </form>
  </header>
  <main>
    <%- body %>
  </main>
</body>
</html>
EOL

# Create app/views/alerts.ejs
cat > app/views/alerts.ejs <<EOL
<% layout('layout') -%>

<h1>Alerts</h1>

<table>
  <thead>
    <tr>
      <th><a href="?<%= new URLSearchParams({ ...query, sortBy: 'timestamp', order: query.order === 'ASC' ? 'DESC' : 'ASC' }).toString() %>">Timestamp</a></th>
      <th><a href="?<%= new URLSearchParams({ ...query, sortBy: 'severity', order: query.order === 'ASC' ? 'DESC' : 'ASC' }).toString() %>">Severity</a></th>
      <th>Source IP</th>
      <th>Destination IP</th>
      <th>Protocol</th>
      <th>Message</th>
      <th>Status</th>
      <th>Action</th>
    </tr>
  </thead>
  <tbody>
    <% alerts.forEach(alert => { %>
    <tr>
      <td><%= alert.timestamp %></td>
      <td><%= alert.severity %></td>
      <td><%= alert.source_ip %></td>
      <td><%= alert.destination_ip %></td>
      <td><%= alert.protocol %></td>
      <td><%= alert.message %></td>
      <td><%= alert.status %></td>
      <td>
        <form method="post" action="/alerts/<%= alert.id %>/status">
          <% if (alert.status === 'new') { %>
          <input type="hidden" name="status" value="escalated">
          <button type="submit">Escalate</button>
          <% } else if (alert.status === 'escalated') { %>
          <input type="hidden" name="status" value="new">
          <button type="submit">Acknowledge</button>
          <% } %>
        </form>
      </td>
    </tr>
    <% }) %>
  </tbody>
</table>

<div class="pagination">
  <% if (page > 1) { %>
  <a href="?<%= new URLSearchParams({ ...query, page: page - 1 }).toString() %>">Previous</a>
  <% } %>
  <span>Page <%= page %> of <%= totalPages %></span>
  <% if (page < totalPages) { %>
  <a href="?<%= new URLSearchParams({ ...query, page: page + 1 }).toString() %>">Next</a>
  <% } %>
</div>
EOL

# Create app/views/stats.ejs
cat > app/views/stats.ejs <<EOL
<% layout('layout') -%>

<h1>Statistics</h1>

<p>Total Alerts: <%= totalAlerts %></p>

<h2>Alerts by Severity</h2>
<ul>
  <% severityCounts.forEach(item => { %>
    <li><%= item.severity %>: <%= item.dataValues.count %></li>
  <% }) %>
</ul>
EOL

# Create app/public/css/styles.css
cat > app/public/css/styles.css <<EOL
body {
  font-family: Arial, sans-serif;
}

header nav ul {
  list-style-type: none;
  display: flex;
  padding: 0;
}

header nav ul li {
  margin-right: 20px;
}

header nav ul li a {
  text-decoration: none;
}

header nav ul li a.active {
  font-weight: bold;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
}

table, th, td {
  border: 1px solid #ccc;
}

th, td {
  padding: 10px;
  text-align: left;
}

.pagination {
  margin-top: 20px;
}
EOL

# Create app/server.js
cat > app/server.js <<EOL
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
      { source_ip: { [Op.iLike]: \`%\${search}%\` } },
      { destination_ip: { [Op.iLike]: \`%\${search}%\` } },
      { message: { [Op.iLike]: \`%\${search}%\` } },
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
      { source_ip: { [Op.iLike]: \`%\${search}%\` } },
      { destination_ip: { [Op.iLike]: \`%\${search}%\` } },
      { message: { [Op.iLike]: \`%\${search}%\` } },
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
      { source_ip: { [Op.iLike]: \`%\${search}%\` } },
      { destination_ip: { [Op.iLike]: \`%\${search}%\` } },
      { message: { [Op.iLike]: \`%\${search}%\` } },
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
  console.log(\`Server is running on port \${PORT}\`);
});
EOL

# Create app/logParser.js
cat > app/logParser.js <<EOL
const fs = require('fs');
const chokidar = require('chokidar');
const { Alert } = require('./models');

// Watch the eve.json file
const watcher = chokidar.watch('/var/log/suricata/eve.json', {
  persistent: true,
  usePolling: true,
  interval: 1000,
});

let fileSize = 0;

watcher.on('change', (path) => {
  fs.stat(path, (err, stats) => {
    if (err) return console.error(err);

    if (stats.size > fileSize) {
      const stream = fs.createReadStream(path, {
        start: fileSize,
        end: stats.size,
      });

      let leftover = '';
      stream.on('data', async (data) => {
        const lines = (leftover + data.toString()).split('\\n');
        leftover = lines.pop();
        for (let line of lines) {
          if (line.trim()) {
            try {
              const json = JSON.parse(line);
              if (json.alert) {
                await Alert.create({
                  alertId: json.alert.signature_id,
                  timestamp: json.timestamp,
                  severity: json.alert.severity.toString(),
                  source_ip: json.src_ip,
                  destination_ip: json.dest_ip,
                  protocol: json.proto,
                  message: json.alert.signature,
                  status: 'new',
                });
              }
            } catch (e) {
              console.error('Error parsing JSON:', e);
            }
          }
        }
      });

      fileSize = stats.size;
    }
  });
});
EOL

echo "Setup complete."
