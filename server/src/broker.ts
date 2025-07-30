// Inclusão dos módulos
import mqtt from 'mqtt';
import express from 'express';
import dotenv from 'dotenv';
import { createObjectCsvWriter } from 'csv-writer';
import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";

// Recebe as configurações das variáveis de ambiente, ou usa um padrão.
dotenv.config();
const MQTT_URL = process.env.MQTT_URL || "mqtt://localhost:1883";
const MQTT_PORT = process.env.MQTT_PORT || 1883;
const MQTT_TOPIC = process.env.MQTT_TOPIC || 'can/messages';
const CSV_FILE_NAME = process.env.CSV_FILE_NAME || 'data.csv';
const OUT_DIR = process.env.OUT_DIR || '../out';
const EXPRESS_PORT = process.env.EXPRESS_PORT || 3000

// Setup MQTT conection
const client = mqtt.connect(MQTT_URL);

// Setup SQLite database
const db = new sqlite3.Database(path.join(OUT_DIR, 'data.sqlite'));

// Setup CSV writer
const csvWriter = createObjectCsvWriter({
  path: path.join(OUT_DIR, CSV_FILE_NAME),
  header: [
    { id: 'speed', title: 'Speed' },
    { id: 'rpm', title: 'RPM' },
    { id: 'pedal_position', title: 'PedalPosition' },
    { id: 'fuel_usage', title: 'FuelUsage' },
    { id: 'accel_x', title: 'Aceleracao frontal' },
    { id: 'accel_y', title: 'Aceleracao lateral' }
  ],
  append: true
});

// Salva dados recebidos no MQTT em um arquivo CSV
async function saveToCSV(entry: {
  speed: number,
  rpm: number,
  pedal_position: number,
  fuel_usage: number,
  accel_x: number,
  accel_y: number
}) {
  await csvWriter.writeRecords([entry]);
}

async function main() {
  // Create SQLite table to store messages
  await new Promise<void>((resolve, reject) => db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      speed REAL,
      rpm REAL,
      pedal_position REAL,
      fuel_usage REAL,
      accel_x REAL,
      accel_y REAL
    )`, 
    (err) => {
    if(err) reject(err);
    resolve();
  }));

  client.on("connect", () => {
    console.log("Connected to MQTT broker");
    client.subscribe(MQTT_TOPIC, (err) => {
      if (err) {
        console.error("Failed to subscribe to topic:", err);
      } else {
        console.log(`Subscribed to topic: ${MQTT_TOPIC}`);
      }
    });
  });

  let state = {
    speed: 0,
    rpm: 0,
    pedal_position: 0,
    fuel_usage: 0,
    accel_x: 0,
    accel_y: 0,
  };

  const arrived: [boolean, boolean] = [false, false]; 

  client.on("message", async (receivedTopic, message) => {
    if (receivedTopic === MQTT_TOPIC) {
      try {
        const parsed = JSON.parse(message.toString());
        const { origin, speed, rpm, pedal_position, fuel_usage, accel_x, accel_y } = parsed;

        // Check if all required fields are present and valid
        if (!origin || typeof origin != `string` || [speed, rpm, pedal_position, fuel_usage, accel_x, accel_y].some(v => v == null || isNaN(v))) {
          console.log("Invalid or null data:", parsed);
          return;
        }

        state = { ...state, ...parsed };

        if(origin && origin == `esp`) {
          arrived[0] = true;
          if(
            rpm != undefined &&
            speed != undefined &&
            pedal_position != undefined &&
            fuel_usage != undefined
          ) arrived[1] = true;
        }
        else if(origin && origin == `python`) arrived[1] = true;

        if(arrived.reduce((a,e) => a && e, true)) {
          arrived[0] = arrived[1] = false;

          // Save in CSV
          await saveToCSV({
            speed: state.speed,
            rpm: state.rpm,
            pedal_position: state.pedal_position,
            fuel_usage: state.fuel_usage,
            accel_x: state.accel_x,
            accel_y: state.accel_y
          });
          // Save in SQL database
          db.run(
            "INSERT INTO messages (speed, rpm, pedal_position, fuel_usage, accel_x, accel_y) VALUES (?, ?, ?, ?, ?, ?)",
            state.speed,
            state.rpm,
            state.pedal_position,
            state.fuel_usage,
            state.accel_x,
            state.accel_y,
          );
          console.log("Message saved:", parsed);
        }

      } catch (err) { console.error("Failed to process message:", err); }
    }
  });

  // Setup REST API with express
  const app = express();
  app.use(express.json());

  // TODO: Configurar rotas para obter dados do sqlite
  app.get("/readings", (req, res) => {
    const query = `
      SELECT * FROM messages
      ORDER BY timestamp DESC
      LIMIT 50
    `;

    db.all(query, [], (err, rows) => {
      if (err) {
        console.error("DB error:", err.message);
        res.status(500).json({ error: "DB error" });
      } else {
        res.json(rows);
      }
    });
  });

  // Cria o endpoint no caminho raiz para servir o cliente.
  // Recuperar o __dirname equivalente em ESModules
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  
  app.use(express.static(path.join(__dirname, '../../client/dist')));
  app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../../client/dist", "index.html"));
  });

  // Start the server
  app.listen(EXPRESS_PORT, () => {
      console.log(`Server running on http://localhost:${EXPRESS_PORT}`);
  });
}

process.on("SIGINT", async () => {
  console.log("Shutting down...");
  client.end();   
  db.close();
  process.exit();
});

main().catch((err) => {
  console.error("Failed to start application:", err);
});
