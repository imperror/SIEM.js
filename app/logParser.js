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
        const lines = (leftover + data.toString()).split('\n');
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
