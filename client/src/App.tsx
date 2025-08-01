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

// import { dot, exp, multiply, sum, subtract, square, divide, transpose, prod } from 'mathjs';

type Vector = number[];
type Matrix = number[][];

function calys(x: Vector, num_rules: number): number {
  const centers = [
		[0.0490558482896263,-0.105598408167837,0.438765790661676,0.267081400563683,0.819061658925439],
		[0.236246923505834,0.197542782002023,-0.221192068072892,0.799949661741411,0.826576865235923],
		[0.0732544112056173,0.0689442924637751,0.659857218710483,0.111205988312118,0.361216325480679],
		[1.01593510526099,-0.291886867554814,1.1032720526406,0.642800956409264,0.3445790739887],
		[0.467514153095596,0.301347103238579,-0.0588872112387903,0.796157345900515,0.448151347363577],
  ];

  const weights = [
		[0.859731982071087,0.246038148666088,0.10460382204283,0.786192104035737,0.0843561820710306],
		[0.177647347287926,0.361054376700151,0.347658277748663,0.436058903289763,0.949921541554521],
		[0.379509214998371,0.133012687203778,-0.474991967965782,0.195301315245427,0.631766319534287],
		[0.0830334855214733,-0.867743963176962,-1.12720512871965,0.511838783417043,0.875457674907005],
		[0.348030834324276,0.460510031276645,0.364809297914749,0.218194599687907,0.331805873595328],
  ]

  const biases = [
    0.644888443218239,2.99385900352075,2.12468160947432,0.798905704978102,0.247685620509565
  ]

  const sigmas = [
		[0.165099673186328,0.210591610193627,0.145873608958365,0.41808940885063,0.0627769464939016],
		[0.571464417664457,0.0857613779094965,0.789674903397535,0.800284310451535,0.0119552552953188],
		[0.299911706351461,0.0760992315407587,-1.1411070047127,0.571856117502726,0.118303811735638],
		[0.538275013010416,0.243462775690805,0.337785760857641,0.198958723367639,0.0317162931626925],
		[-0.0215718326338469,0.255745266976083,0.560811196274143,0.0326930561009974,0.324600087609204],
  ]

  // rule_outputs = biases + dot(x, weights)
  const rule_outputs: Vector = biases.map((b, j) =>
    b + x.reduce((acc, xi, i) => acc + xi * weights[i][j], 0)
  );

  // diff = x[:, None] - centers
  const diff: Matrix = x.map((xi, i) =>
    centers[i].map((cij) => xi - cij)
  );

  // exponent = -0.5 * (diff ** 2) / (sigmas ** 2)
  const exponent: Matrix = diff.map((row, i) =>
    row.map((val, j) => -0.5 * (val ** 2) / (sigmas[i][j] ** 2))
  );

  // rule_weights = exp(exponent).prod(axis=0)
  const exp_exponent: Matrix = exponent.map((row) => row.map((val) => Math.exp(val)));
  const rule_weights: Vector = Array(num_rules).fill(0).map((_, j) =>
    exp_exponent.map((row) => row[j]).reduce((acc, val) => acc * val, 1)
  );

  const numerator = rule_weights.reduce((acc, wj, j) => acc + wj * rule_outputs[j], 0);
  const denominator = rule_weights.reduce((acc, wj) => acc + wj, 0);

  const output = numerator / (denominator + 1e-8);

  return output; // [output, rule_weights, rule_outputs, denominator];
}

export default function App() {
  const [data, setData] = useState<Reading[]>([]);
  const [classification, setClassification] = useState<number[]>([]);

  useEffect(() => {
    document.title = "CAN Dashboard";

    let last_acc = 0;
    const fetchData = async () => {
      try {
        const res = await fetch("/readings", { cache: "no-store" });
        const json: Reading[] = await res.json();
        console.log(json);
        setData(json.reverse()); // do mais antigo ao mais recente

        const extendedData = json.map((d, i, arr) => {
          const acc_norm = Math.sqrt(d.accel_x ** 2 + d.accel_y ** 2);
          const prev = i > 0 ? arr[i - 1] : d;
          const delta_acc_lat = d.accel_y - prev.accel_y;
          return { ...d, acc_norm, delta_acc_lat };
        });

        const maxes = extendedData.reduce(
          (acc, el) => ({
            speed: Math.max(el.speed, acc.speed),
            rpm: Math.max(el.rpm, acc.rpm),
            pedal_position: Math.max(el.pedal_position, acc.pedal_position),
            acc_norm: Math.max(el.acc_norm, acc.acc_norm),
            delta_acc_lat: Math.max(Math.abs(el.delta_acc_lat), acc.delta_acc_lat),
          }),
          { speed: 0, rpm: 0, pedal_position: 0, acc_norm: 0, delta_acc_lat: 0 }
        );

        setClassification(json.map(e => {
          const received = e;
          let data: Reading & {
            acc_norm: number;
            delta_acc_lat: number;
          } = {
            ...received,
            acc_norm: Math.sqrt(received.accel_x ** 2 + received.accel_y ** 2),
            delta_acc_lat: received.accel_y - last_acc
          }

          const input = [
            data.speed / (maxes.speed || 1),
            data.acc_norm / (maxes.acc_norm || 1),
            data.rpm / (maxes.rpm || 1),
            data.pedal_position / (maxes.pedal_position || 1),
            data.delta_acc_lat / (maxes.delta_acc_lat || 1),
          ];

          return calys(input, 5);
        }));

      } catch (err) {
        console.error("Erro ao buscar dados:", err);
      }
    };

    fetchData(); // inicial
    const interval = setInterval(fetchData, 1000); // 1s

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: 20, width: "100vw", height: "100vh" }}>
      <h1>Sensor Monitor</h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr", // 2 colunas
          gridGap: 20,                   // espaçamento entre gráficos
        }}
      >
        <LiveChart
          data={classification.map(e => ({ d: e})) }
          dataKey="d"
          color="#8884d8"
          name="Accel_X"
          title="Aceleração X (acelerômetro)"
        />

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
    </div>
  );
}
