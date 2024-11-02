const fs = require('fs');
const chokidar = require('chokidar');
const { Alert, Event } = require('./models');

// Watch the eve.json file
const watcher = chokidar.watch('/var/log/suricata/eve.json', {
  persistent: true,
  usePolling: true,
  interval: 1000,
});

let fileSize = 0;

// Define allowed event types
const allowedEventTypes = ['alert', 'dns', 'http', 'tls', 'ssh', 'smtp', 'files', 'flow'];

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
        const lines = (leftover + data.toString()).split('\n');
        leftover = lines.pop();
        for (let line of lines) {
          if (line.trim()) {
            try {
              const json = JSON.parse(line);

              // Skip processing if the event type is not in the allowed list
              if (!allowedEventTypes.includes(json.event_type)) {
                continue;
              }

              // Define common data for all events
              const eventData = {
                eventType: json.event_type || 'unknown',
                timestamp: json.timestamp,
                source_ip: json.src_ip,
                destination_ip: json.dest_ip,
                protocol: json.proto,
                status: 'new',
              };

              // Check if it's an alert and capture packet data if available
              if (json.alert) {
                console.log("Processing alert:", json.alert.signature);

                await Alert.create({
                  alertId: json.alert.signature_id,
                  timestamp: json.timestamp,
                  severity: json.alert.severity.toString(),
                  source_ip: json.src_ip,
                  destination_ip: json.dest_ip,
                  protocol: json.proto,
                  message: json.alert.signature,
                  status: 'new',
                  packetData: json.payload || null, // Store packet data if available
                });

                eventData.alertId = json.alert.signature_id;
                eventData.severity = json.alert.severity.toString();
                eventData.message = json.alert.signature;
              } else {
                // For non-alert events, fill in relevant fields if they exist
                eventData.severity = json.severity || null;
                eventData.message = json.message || null;
              }

              // Log to Events table
              await Event.create(eventData);
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
