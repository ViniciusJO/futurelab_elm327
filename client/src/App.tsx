import { useEffect, useState } from "react";
import LiveChart from "./LiveChart";

type Reading = {
  timestamp: string;
  accel_x: number;
  accel_y: number;
  speed: number;
  rpm: number;
  pedal_position: number;
  fuel_usage: number;
};

export default function App() {
  const [data, setData] = useState<Reading[]>([]);

  useEffect(() => {
    document.title = "CAN Dashboard";

    const fetchData = async () => {
      try {
        const res = await fetch("/readings", { cache: "no-store" });
        const json: Reading[] = await res.json();
        console.log(json);
        setData(json.reverse()); // do mais antigo ao mais recente
      } catch (err) {
        console.error("Erro ao buscar dados:", err);
      }
    };

    fetchData(); // inicial
    const interval = setInterval(fetchData, 1000); // 1s

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Sensor Monitor</h1>
      <LiveChart
        data={data}
        dataKey="accel_x"
        color="#8884d8"
        name="Accel_X"
        title="Aceleração X (acelerômetro)"
      />

      <LiveChart
        data={data}
        dataKey="accel_y"
        color="#8884d8"
        name="Accel_Y"
        title="Aceleração Y (acelerômetro)"
      />

      <LiveChart
        data={data}
        dataKey="speed"
        color="#8884d8"
        name="Speed"
        title="Velocidade (010D)"
      />

      <LiveChart
        data={data}
        dataKey="rpm"
        color="#82ca9d"
        name="RPM"
        title="RPM (010C)"
      />

      <LiveChart
        data={data}
        dataKey="pedal_position"
        color="#ff7300"
        name="Pedal Position"
        title="Posição do Pedal (0111)"
      />

      <LiveChart
        data={data}
        dataKey="fuel_usage"
        color="#ff0000"
        name="Fuel Usage"
        title="Consumo de Combustível (015E)"
      />
    </div>
  );
}
