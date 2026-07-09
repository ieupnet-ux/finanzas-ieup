import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Calendar,
} from 'lucide-react';

export default function DashboardHome({ stats }) {
  const [chartData, setChartData] = useState([]);
  const [movimientosPorTipo, setMovimientosPorTipo] = useState([]);

  useEffect(() => {
    loadChartData();
  }, []);

  const loadChartData = async () => {
    try {
      const { data: movimientos } = await supabase
        .from('movimientos')
        .select('*')
        .order('fecha', { ascending: true })
        .limit(30);

      if (movimientos) {
        const grouped = {};
        movimientos.forEach((mov) => {
          const date = mov.fecha.split('T')[0];
          if (!grouped[date]) {
            grouped[date] = { date, ingresos: 0, egresos: 0 };
          }
          if (mov.tipo === 'ingreso') {
            grouped[date].ingresos += mov.monto;
          } else {
            grouped[date].egresos += mov.monto;
          }
        });
        setChartData(Object.values(grouped));
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const COLORS = ['#FFD700', '#C41E3A', '#001f3f', '#D4AF37'];

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="mb-8 flex items-center gap-4">
        <img 
          src="/logo-navy.png" 
          alt="IEUP" 
          className="w-16 h-16"
        />
        <div>
          <h1 className="text-4xl font-bold text-navy mb-2">Dashboard Finanzas</h1>
          <p className="text-gray-600">
            {new Date().toLocaleDateString('es-ES', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={TrendingUp} label="Ingresos Totales" amount={stats?.totalIngresos || 0} color="bg-green-100" textColor="text-green-800" />
        <StatCard icon={TrendingDown} label="Egresos Totales" amount={stats?.totalEgresos || 0} color="bg-red-100" textColor="text-red-800" />
        <StatCard icon={Wallet} label="Saldo Actual" amount={stats?.saldo || 0} color="bg-gold bg-opacity-20" textColor="text-oro" />
        <StatCard icon={Calendar} label="Año" amount={new Date().getFullYear()} color="bg-navy bg-opacity-20" textColor="text-navy" isYear={true} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-xl font-bold text-navy mb-4">Movimientos (Últimos 30 días)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#666" />
              <YAxis stroke="#666" />
              <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px' }} />
              <Legend />
              <Line type="monotone" dataKey="ingresos" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e', r: 4 }} />
              <Line type="monotone" dataKey="egresos" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold text-navy mb-4">Distribución</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={[]} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="monto">
                {COLORS.map((color, index) => (<Cell key={index} fill={color} />))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-bold text-navy mb-4">Resumen Mensual</h2>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" stroke="#666" />
            <YAxis stroke="#666" />
            <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px' }} />
            <Legend />
            <Bar dataKey="ingresos" fill="#22c55e" radius={[8, 8, 0, 0]} />
            <Bar dataKey="egresos" fill="#ef4444" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, amount, color, textColor, isYear }) {
  const formattedAmount = isYear 
    ? amount 
    : typeof amount === 'number'
    ? `$${amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`
    : amount;

  return (
    <div className={`${color} rounded-lg p-6 ${textColor}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-75">{label}</p>
          <p className="text-2xl font-bold mt-2">{formattedAmount}</p>
        </div>
        <Icon size={32} className="opacity-50" />
      </div>
    </div>
  );
}
