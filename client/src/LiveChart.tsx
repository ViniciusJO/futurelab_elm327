import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer
} from "recharts";

type LiveChartProps = {
  data: any[];
  dataKey: string;
  color: string;
  name: string;
  title: string;
};

export default function LiveChart(props: LiveChartProps) {
  const { data, dataKey, color, name, title } = props;
  const formatTime = (ts: string) => new Date(ts).toLocaleTimeString();

  return (
    <section style={{ marginBottom: 50 }}>
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <CartesianGrid stroke="#ccc" />
          <XAxis dataKey="timestamp" tickFormatter={formatTime} />
          <YAxis />
          <Tooltip labelFormatter={formatTime} />
          <Legend />
          <Line type="monotone" dataKey={dataKey} stroke={color} name={name} />
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}
