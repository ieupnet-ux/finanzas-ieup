import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Download, Filter } from 'lucide-react';
import Papa from 'papaparse';

export default function Reportes() {
  const [movimientos, setMovimientos] = useState([]);
  const [filteredMovimientos, setFilteredMovimientos] = useState([]);
  const [fechaInicio, setFechaInicio] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().split('T')[0]);
  const [stats, setStats] = useState({ ingresos: 0, egresos: 0, saldo: 0 });

  useEffect(() => {
    loadMovimientos();
  }, []);

  useEffect(() => {
    filtrarPorPeriodo();
  }, [movimientos, fechaInicio, fechaFin]);

  const loadMovimientos = async () => {
    const { data } = await supabase
      .from('movimientos')
      .select('*')
      .order('fecha', { ascending: false });
    
    setMovimientos(data || []);
  };

  const filtrarPorPeriodo = () => {
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    fin.setHours(23, 59, 59);

    const filtered = movimientos.filter(m => {
      const fecha = new Date(m.fecha);
      return fecha >= inicio && fecha <= fin;
    });

    setFilteredMovimientos(filtered);

    // Calcular totales
    const totalIngresos = filtered
      .filter(m => m.tipo === 'ingreso')
      .reduce((sum, m) => sum + (m.monto || 0), 0);

    const totalEgresos = filtered
      .filter(m => m.tipo === 'egreso')
      .reduce((sum, m) => sum + (m.monto || 0), 0);

    setStats({
      ingresos: totalIngresos,
      egresos: totalEgresos,
      saldo: totalIngresos - totalEgresos
    });
  };

  const exportarCSV = () => {
    const data = filteredMovimientos.map(m => ({
      Fecha: new Date(m.fecha).toLocaleDateString('es-ES'),
      Tipo: m.tipo === 'ingreso' ? 'INGRESO' : 'EGRESO',
      Concepto: m.concepto,
      Monto: m.monto,
      Centro: m.centro_costos || '—',
      Templo: m.templo_id || '—'
    }));

    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte-finanzas-${fechaInicio}-a-${fechaFin}.csv`;
    link.click();
  };

  const exportarGoogleSheets = () => {
    const url = `https://docs.google.com/spreadsheets/create?title=Reporte%20Finanzas%20IEUP%20${fechaInicio}`;
    window.open(url, '_blank');
    alert('Se abrirá Google Sheets. Copia manualmente los datos de abajo.');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-bold text-navy mb-2">Reportes Financieros</h1>

      {/* Filtro por período */}
      <div className="card bg-blue-50 border-l-4 border-blue-500">
        <h2 className="text-xl font-bold text-navy mb-4 flex items-center gap-2">
          <Filter size={24} />
          Filtrar por Período
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-bold text-navy mb-2">Fecha Inicio</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="input-field w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-navy mb-2">Fecha Fin</label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="input-field w-full"
            />
          </div>
          <button onClick={filtrarPorPeriodo} className="btn-primary w-full">
            Aplicar Filtro
          </button>
        </div>
      </div>

      {/* Resumen del período */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card bg-green-50">
          <p className="text-sm text-gray-600 mb-1">Ingresos</p>
          <p className="text-3xl font-bold text-green-600">${stats.ingresos.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="card bg-red-50">
          <p className="text-sm text-gray-600 mb-1">Egresos</p>
          <p className="text-3xl font-bold text-red-600">${stats.egresos.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className={`card ${stats.saldo >= 0 ? 'bg-blue-50' : 'bg-red-50'}`}>
          <p className="text-sm text-gray-600 mb-1">Saldo</p>
          <p className={`text-3xl font-bold ${stats.saldo >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            ${stats.saldo.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Botones de exportación */}
      <div className="flex gap-3">
        <button onClick={exportarCSV} className="btn-primary flex items-center gap-2">
          <Download size={20} />
          Descargar CSV
        </button>
        <button onClick={exportarGoogleSheets} className="btn-secondary flex items-center gap-2">
          <Download size={20} />
          Abrir en Google Sheets
        </button>
      </div>

      {/* Tabla de movimientos */}
      <div className="card">
        <h2 className="text-xl font-bold text-navy mb-4">
          Movimientos ({filteredMovimientos.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gold">
                <th className="text-left p-3 text-navy font-bold">Fecha</th>
                <th className="text-left p-3 text-navy font-bold">Tipo</th>
                <th className="text-left p-3 text-navy font-bold">Concepto</th>
                <th className="text-left p-3 text-navy font-bold">Monto</th>
                <th className="text-left p-3 text-navy font-bold">Centro Costos</th>
              </tr>
            </thead>
            <tbody>
              {filteredMovimientos.length > 0 ? (
                filteredMovimientos.map((mov, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="p-3 text-sm">{new Date(mov.fecha).toLocaleDateString('es-ES')}</td>
                    <td className="p-3">
                      <span className={`px-3 py-1 rounded text-white text-xs font-bold ${
                        mov.tipo === 'ingreso' ? 'bg-green-500' : 'bg-red-500'
                      }`}>
                        {mov.tipo === 'ingreso' ? 'INGRESO' : 'EGRESO'}
                      </span>
                    </td>
                    <td className="p-3 font-medium">{mov.concepto}</td>
                    <td className={`p-3 font-bold ${mov.tipo === 'ingreso' ? 'text-green-600' : 'text-red-600'}`}>
                      ${mov.monto?.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3">{mov.centro_costos || '—'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="p-6 text-center text-gray-500">
                    No hay movimientos en este período
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
