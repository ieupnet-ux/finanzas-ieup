import { useEffect, useState, useRef, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { Download, Plus, Settings, Edit2, Trash2, X, Upload, Filter } from 'lucide-react';
import Papa from 'papaparse';


const PERIODOS_FILTRO = [
  { value: 'todo', label: 'Todo' },
  { value: 'este-mes', label: 'Este mes' },
  { value: 'mes-anterior', label: 'Mes anterior' },
  { value: 'ultimos-3-meses', label: 'Últimos 3 meses' },
  { value: 'este-anio', label: 'Este año' },
  { value: 'personalizado', label: 'Personalizado' },
];


// Parsear fecha como fecha LOCAL (evita el corrimiento de un día por zona horaria)
function parseFechaLocal(fecha) {
  if (!fecha) return new Date(0);
  const [y, m, d] = String(fecha).split('T')[0].split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function rangoPeriodo(periodo, desde, hasta) {
  const hoy = new Date();
  const inicioDia = (d) => { d.setHours(0, 0, 0, 0); return d; };
  const finDia = (d) => { d.setHours(23, 59, 59, 999); return d; };
  switch (periodo) {
    case 'este-mes':
      return [inicioDia(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), finDia(new Date(hoy))];
    case 'mes-anterior':
      return [inicioDia(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)), finDia(new Date(hoy.getFullYear(), hoy.getMonth(), 0))];
    case 'ultimos-3-meses':
      return [inicioDia(new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1)), finDia(new Date(hoy))];
    case 'este-anio':
      return [inicioDia(new Date(hoy.getFullYear(), 0, 1)), finDia(new Date(hoy))];
    case 'personalizado':
      return [
        desde ? inicioDia(new Date(desde + 'T00:00:00')) : new Date(2000, 0, 1),
        hasta ? finDia(new Date(hasta + 'T00:00:00')) : finDia(new Date(hoy)),
      ];
    default:
      return [new Date(2000, 0, 1), finDia(new Date(hoy))];
  }
}

export default function Egresos() {
  const [egresos, setEgresos] = useState([]);
  const [conceptos, setConceptos] = useState([]);
  const [templos, setTemplos] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newConcept, setNewConcept] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const fileInputRef = useRef(null);

  // Filtros de la tabla
  const [filtroPeriodo, setFiltroPeriodo] = useState('todo');
  const [filtroDesde, setFiltroDesde] = useState('');
  const [filtroHasta, setFiltroHasta] = useState('');
  const [filtroTemplo, setFiltroTemplo] = useState('');
  const [filtroCaja, setFiltroCaja] = useState('');

  // Paginación de la tabla
  const [pagina, setPagina] = useState(1);
  const POR_PAGINA = 50;

  // Ordenamiento de la tabla
  const [sortField, setSortField] = useState('fecha');
  const [sortDir, setSortDir] = useState('desc');

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };
  const [formData, setFormData] = useState({
    monto: '',
    concepto: '',
    templo: '',
    moneda: 'ARS',
    tipo_transaccion: 'efectivo',
    ubicacion: 'general',
    detalle: '',
    fecha: new Date().toISOString().split('T')[0]
  });

  const monedas = [
    { code: 'ARS', label: '🇦🇷 Pesos Argentinos' },
    { code: 'USD', label: '🇺🇸 Dólares' },
    { code: 'CLP', label: '🇨🇱 Pesos Chilenos' }
  ];

  const tiposTransaccion = [
    { value: 'efectivo', label: '💵 Efectivo' },
    { value: 'deposito', label: '🏦 Depósito Bancario' },
    { value: 'extraccion', label: '💸 Extracción Bancaria' },
    { value: 'plazo-fijo', label: '📅 Plazo Fijo' },
    { value: 'billetera-virtual', label: '📱 Billetera Virtual' }
  ];

  const ubicaciones = [
    // CAJAS
    { value: 'adolescentes', label: '👦 Adolescentes' },
    { value: 'ciclistas', label: '🚴 Ciclistas' },
    { value: 'coro', label: '🎵 Coro' },
    { value: 'coro-juvenil', label: '🎤 Coro Juvenil' },
    { value: 'dorcas', label: '👵 Dorcas' },
    { value: 'general', label: '💼 General' },
    { value: 'jovenes', label: '👥 Jóvenes' },
    { value: 'ninos', label: '👶 Niños' },
    { value: 'porteras', label: '👩 Porteras' },
    { value: 'porteros', label: '👨 Porteros' },
    { value: 'emisora', label: '📻 Emisora' },
    { value: 'cajas', label: '📦 Cajas' },
    { value: 'reposteria', label: '🍰 Repostería' },
    { value: 'secretaria', label: '📋 Secretaría' },
    // BANCOS
    { value: 'banco-nacion', label: '🏦 Banco Nación' },
    { value: 'banco-macro', label: '🏦 Banco Macro' },
    // OTROS
    { value: 'plazo-fijo', label: '📅 Plazo Fijo' },
    { value: 'mercado-pago', label: '📱 Mercado Pago' },
    { value: 'billetera-virtual', label: '📱 Billetera Virtual' },
    { value: 'otro', label: '❓ Otro' }
  ];

  useEffect(() => {
    loadData();
  }, []);

  // Volver a la página 1 al cambiar filtros u ordenamiento
  useEffect(() => {
    setPagina(1);
  }, [filtroPeriodo, filtroDesde, filtroHasta, filtroTemplo, filtroCaja, sortField, sortDir]);

  const loadData = async () => {
    const { data: egr } = await supabase.from('movimientos').select('*').eq('tipo', 'egreso');
    setEgresos(egr || []);

    const { data: temp } = await supabase.from('templos').select('*');
    setTemplos(temp || []);

    const { data: conceptosData } = await supabase.from('conceptos').select('*');
    setConceptos(conceptosData || []);
  };

  const handleAddConcept = async () => {
    if (!newConcept) return;
    
    await supabase.from('conceptos').insert({
      nombre: newConcept,
      tipo: 'egreso'
    });
    
    setNewConcept('');
    loadData();
  };

  const handleAddEgreso = async (e) => {
    e.preventDefault();
    
    if (editingId) {
      const { error } = await supabase.from('movimientos').update({
        monto: parseFloat(formData.monto),
        concepto: formData.concepto,
        templo_id: formData.templo || null,
        moneda: formData.moneda,
        tipo_transaccion: formData.tipo_transaccion,
        ubicacion: formData.ubicacion,
        detalle: formData.detalle,
        fecha: formData.fecha
      }).eq('id', editingId);

      if (error) {
        setImportMessage(`❌ Error al actualizar: ${error.message}`);
        setTimeout(() => setImportMessage(''), 6000);
        return;
      }
      setImportMessage('✅ Registro actualizado correctamente');
      setTimeout(() => setImportMessage(''), 4000);
      setEditingId(null);
    } else {
      const { error } = await supabase.from('movimientos').insert({
        monto: parseFloat(formData.monto),
        concepto: formData.concepto,
        templo_id: formData.templo || null,
        moneda: formData.moneda,
        tipo_transaccion: formData.tipo_transaccion,
        ubicacion: formData.ubicacion,
        detalle: formData.detalle,
        tipo: 'egreso',
        fecha: formData.fecha
      });

      if (error) {
        setImportMessage(`❌ Error al guardar: ${error.message}`);
        setTimeout(() => setImportMessage(''), 6000);
        return;
      }
    }
    
    setFormData({ 
      monto: '', concepto: '', templo: '', moneda: 'ARS', 
      tipo_transaccion: 'efectivo', ubicacion: 'general', 
      detalle: '', fecha: new Date().toISOString().split('T')[0] 
    });
    setShowForm(false);
    loadData();
  };

  const handleEditEgreso = (egreso) => {
    setFormData({
      monto: egreso.monto,
      concepto: egreso.concepto,
      templo: egreso.templo_id || '',
      moneda: egreso.moneda || 'ARS',
      tipo_transaccion: egreso.tipo_transaccion || 'efectivo',
      ubicacion: egreso.ubicacion || 'general',
      detalle: egreso.detalle || '',
      fecha: (egreso.fecha || new Date().toISOString()).split('T')[0]
    });
    setEditingId(egreso.id);
    setShowForm(true);
    setShowSettings(false);
    // Subir al formulario para que el usuario lo vea
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
  };

  const handleDeleteEgreso = async (id) => {
    if (confirm('¿Eliminar este egreso? La acción quedará registrada en auditoría.')) {
      await supabase.from('movimientos').delete().eq('id', id);
      loadData();
    }
  };

  // Registros filtrados por período, templo y caja
  const filtrados = useMemo(() => {
    const [ini, fin] = rangoPeriodo(filtroPeriodo, filtroDesde, filtroHasta);
    return egresos.filter(m => {
      const f = parseFechaLocal(m.fecha);
      if (f < ini || f > fin) return false;
      if (filtroTemplo && m.templo_id !== filtroTemplo) return false;
      if (filtroCaja && (m.ubicacion || 'general') !== filtroCaja) return false;
      return true;
    });
  }, [egresos, filtroPeriodo, filtroDesde, filtroHasta, filtroTemplo, filtroCaja]);

  // Totales por moneda de los registros filtrados
  const totalesFiltrados = useMemo(() => {
    const t = {};
    filtrados.forEach(m => {
      const mon = m.moneda || 'ARS';
      t[mon] = (t[mon] || 0) + (m.monto || 0);
    });
    return t;
  }, [filtrados]);

  // Registros ordenados según la columna seleccionada
  const ordenados = useMemo(() => {
    const arr = [...filtrados];
    arr.sort((a, b) => {
      let va = a[sortField];
      let vb = b[sortField];
      if (sortField === 'templo') {
        va = a.templo_id ? (templos.find(t => t.id === a.templo_id)?.nombre || '') : '';
        vb = b.templo_id ? (templos.find(t => t.id === b.templo_id)?.nombre || '') : '';
      }
      if (sortField === 'fecha') {
        va = parseFechaLocal(a.fecha).getTime();
        vb = parseFechaLocal(b.fecha).getTime();
      } else if (sortField === 'monto') {
        va = a.monto || 0;
        vb = b.monto || 0;
      } else {
        va = String(va || '').toLowerCase();
        vb = String(vb || '').toLowerCase();
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtrados, sortField, sortDir, templos]);

  // Página actual de resultados
  const totalPaginas = Math.max(1, Math.ceil(ordenados.length / POR_PAGINA));
  const paginados = ordenados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  const flecha = (field) => {
    if (sortField !== field) return <span className="opacity-30 ml-1">↕</span>;
    return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const limpiarFiltros = () => {
    setFiltroPeriodo('todo'); setFiltroDesde(''); setFiltroHasta('');
    setFiltroTemplo(''); setFiltroCaja('');
  };

  const handleExportCSV = () => {
    const data = ordenados.map(ing => ({
      Fecha: parseFechaLocal(ing.fecha).toLocaleDateString('es-ES'),
      Concepto: ing.concepto,
      Monto: ing.monto,
      Moneda: ing.moneda || 'ARS',
      Tipo: tiposTransaccion.find(t => t.value === ing.tipo_transaccion)?.label || '—',
      Ubicación: ubicaciones.find(u => u.value === ing.ubicacion)?.label || '—',
      Detalle: ing.detalle || '—',
      Templo: ing.templo_id ? templos.find(t => t.id === ing.templo_id)?.nombre || '—' : '—'
    }));

    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `egresos-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          // Cargar templos frescos desde Supabase (garantiza que estén disponibles)
          const { data: templosData } = await supabase.from('templos').select('*');
          const templosActuales = templosData || [];

          // Parsear montos en formato argentino: 5.000,00 → 5000.00
          const parseMonto = (valor) => {
            if (typeof valor === 'number') return valor;
            let s = String(valor).trim().replace(/[$\s]/g, '');
            if (s.includes(',')) {
              // Coma presente = separador decimal; puntos = miles
              s = s.replace(/\./g, '').replace(',', '.');
            } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
              // Solo puntos agrupando de a 3 = separadores de miles (5.000 → 5000)
              s = s.replace(/\./g, '');
            }
            return parseFloat(s);
          };

          // Quitar emoji inicial de las etiquetas para comparar por nombre
          const limpiarLabel = (label) => label.replace(/^[^\wáéíóúñÁÉÍÓÚÑ]+/, '').trim().toLowerCase();

          const registrosValidos = [];
          let errores = [];

          for (let i = 0; i < results.data.length; i++) {
            const row = results.data[i];
            
            // Validar campos requeridos
            if (!row.Monto || !row.Concepto || !row.Fecha) {
              errores.push(`Fila ${i + 2}: Faltan campos (Monto, Concepto o Fecha)`);
              continue;
            }

            // Parsear monto (acepta 5000, 5000.50, 5.000,00, $5.000)
            const montoParsed = parseMonto(row.Monto);
            if (isNaN(montoParsed) || montoParsed <= 0) {
              errores.push(`Fila ${i + 2}: Monto inválido "${row.Monto}"`);
              continue;
            }

            // Parsear fecha (DD/MM/YYYY → YYYY-MM-DD)
            let fechaParsed = row.Fecha;
            if (row.Fecha.includes('/')) {
              const [dia, mes, año] = row.Fecha.split('/');
              fechaParsed = `${año}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
            }

            // BUSCAR templo_id por nombre de templo
            let templo_id = null;
            if (row.Templo && row.Templo.trim()) {
              const temploEncontrado = templosActuales.find(t => t.nombre?.toLowerCase().trim() === row.Templo.trim().toLowerCase());
              if (temploEncontrado) {
                templo_id = temploEncontrado.id;
              } else {
                // Si el templo no existe, avisa pero continúa sin templo
                errores.push(`Fila ${i + 2}: Templo "${row.Templo}" no encontrado en la base de datos`);
              }
            }

            // BUSCAR ubicación/caja por nombre (columna "Ubicacion", "Ubicación" o "Caja")
            let ubicacionValue = 'general';
            const ubicacionCSV = (row.Ubicacion || row['Ubicación'] || row.Caja || '').trim();
            if (ubicacionCSV) {
              const ubicEncontrada = ubicaciones.find(u =>
                u.value === ubicacionCSV.toLowerCase() ||
                limpiarLabel(u.label) === ubicacionCSV.toLowerCase()
              );
              if (ubicEncontrada) {
                ubicacionValue = ubicEncontrada.value;
              } else {
                errores.push(`Fila ${i + 2}: Caja/Ubicación "${ubicacionCSV}" no reconocida, se usó General`);
              }
            }

            // BUSCAR tipo de transacción por nombre (columna "Tipo")
            let tipoTransValue = 'efectivo';
            const tipoCSV = (row.Tipo || '').trim();
            if (tipoCSV) {
              const tipoEncontrado = tiposTransaccion.find(t =>
                t.value === tipoCSV.toLowerCase() ||
                limpiarLabel(t.label) === tipoCSV.toLowerCase()
              );
              if (tipoEncontrado) {
                tipoTransValue = tipoEncontrado.value;
              } else {
                errores.push(`Fila ${i + 2}: Tipo "${tipoCSV}" no reconocido, se usó Efectivo`);
              }
            }

            registrosValidos.push({
              monto: montoParsed,
              concepto: row.Concepto.trim(),
              moneda: row.Moneda?.trim().toUpperCase() || 'ARS',
              tipo_transaccion: tipoTransValue,
              ubicacion: ubicacionValue,
              detalle: row.Detalle?.trim() || null,
              templo_id: templo_id,
              tipo: 'egreso',
              fecha: fechaParsed
            });
          }

          if (registrosValidos.length === 0) {
            setImportMessage(`❌ Error: No hay registros válidos. ${errores.join(' | ')}`);
            return;
          }

          // Insertar en Supabase
          const { error } = await supabase.from('movimientos').insert(registrosValidos);

          if (error) {
            setImportMessage(`❌ Error al guardar: ${error.message}`);
          } else {
            setImportMessage(`✅ Importado: ${registrosValidos.length} egresos guardados ${errores.length > 0 ? `(⚠️ ${errores.length} avisos: consulta los templos)` : ''}`);
            loadData();
            setTimeout(() => setImportMessage(''), 5000);
          }
        } catch (err) {
          setImportMessage(`❌ Error: ${err.message}`);
        }
      },
      error: (error) => {
        setImportMessage(`❌ Error al leer CSV: ${error.message}`);
      }
    });

    e.target.value = '';
  };

  const getMonedaSymbol = (moneda) => {
    const symbols = { 'ARS': '$', 'USD': 'U$S', 'CLP': '$' };
    return symbols[moneda] || '$';
  };

  return (
    <div className="space-y-6">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-navy mb-2">Egresos</h1>
          <p className="text-gray-600">Registro y gestión de egresos en múltiples monedas y ubicaciones</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={handleExportCSV}
            className="btn-primary flex items-center gap-2"
          >
            <Download size={20} />
            Exportar CSV
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary flex items-center gap-2"
          >
            <Upload size={20} />
            Importar CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleImportCSV}
            className="hidden"
          />
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="btn-secondary flex items-center gap-2"
          >
            <Settings size={20} />
            Conceptos
          </button>
          <button
            onClick={() => {
              setShowForm(!showForm);
              if (!showForm) setEditingId(null);
              setFormData({ 
                monto: '', concepto: '', templo: '', moneda: 'ARS', 
                tipo_transaccion: 'efectivo', ubicacion: 'general', 
                detalle: '', fecha: new Date().toISOString().split('T')[0] 
              });
            }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={20} />
            Nuevo Egreso
          </button>
        </div>
      </div>

      {/* FILTROS DE LA TABLA */}
      <div className="card bg-blue-50 border-l-4 border-blue-500">
        <h2 className="text-lg font-bold text-navy mb-3 flex items-center gap-2">
          <Filter size={20} /> Filtros
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-bold text-navy mb-1">Período</label>
            <select value={filtroPeriodo} onChange={(e) => setFiltroPeriodo(e.target.value)} className="input-field w-full">
              {PERIODOS_FILTRO.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-navy mb-1">Templo</label>
            <select value={filtroTemplo} onChange={(e) => setFiltroTemplo(e.target.value)} className="input-field w-full">
              <option value="">Todos los templos</option>
              {templos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-navy mb-1">Caja / Ubicación</label>
            <select value={filtroCaja} onChange={(e) => setFiltroCaja(e.target.value)} className="input-field w-full">
              <option value="">Todas las cajas</option>
              {ubicaciones.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={limpiarFiltros} className="btn-secondary w-full">Limpiar filtros</button>
          </div>
        </div>
        {filtroPeriodo === 'personalizado' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block text-xs font-bold text-navy mb-1">Desde</label>
              <input type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} className="input-field w-full" />
            </div>
            <div>
              <label className="block text-xs font-bold text-navy mb-1">Hasta</label>
              <input type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} className="input-field w-full" />
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-4 mt-3 text-sm">
          <span className="font-bold text-navy">{filtrados.length.toLocaleString('es-AR')} egresos</span>
          {Object.entries(totalesFiltrados).map(([mon, total]) => (
            <span key={mon} className="font-bold text-red-600">
              Total {mon}: {getMonedaSymbol(mon)} {total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </span>
          ))}
        </div>
      </div>

      {/* Mensaje de importación */}
      {importMessage && (
        <div className={`card ${importMessage.includes('✅') ? 'bg-green-50 border-l-4 border-green-500' : 'bg-red-50 border-l-4 border-red-500'}`}>
          <p className={importMessage.includes('✅') ? 'text-green-800' : 'text-red-800'}>{importMessage}</p>
        </div>
      )}

      {/* Panel de configuración de conceptos */}
      {showSettings && (
        <div className="card bg-red-50 border-l-4 border-red-500">
          <h2 className="text-xl font-bold text-navy mb-4">Administrar Conceptos de Egresos</h2>
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nuevo concepto"
                value={newConcept}
                onChange={(e) => setNewConcept(e.target.value)}
                className="input-field flex-1"
              />
              <button onClick={handleAddConcept} className="btn-primary">
                Agregar
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {conceptos.filter(c => c.tipo === 'egreso').map((c) => (
                <span key={c.id} className="bg-red-200 text-red-800 px-3 py-1 rounded">
                  {c.nombre}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Formulario para nuevo ingreso */}
      {showForm && (
        <form onSubmit={handleAddEgreso} className="card bg-red-50 border-l-4 border-red-500">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-navy">{editingId ? 'Editar Egreso' : 'Registrar Nuevo Egreso'}</h2>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={24} />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="number"
              placeholder="Monto"
              value={formData.monto}
              onChange={(e) => setFormData({...formData, monto: e.target.value})}
              className="input-field"
              required
            />
            <select
              value={formData.concepto}
              onChange={(e) => setFormData({...formData, concepto: e.target.value})}
              className="input-field"
              required
            >
              <option value="">Selecciona concepto</option>
              {formData.concepto && !conceptos.some(c => c.tipo === 'egreso' && c.nombre === formData.concepto) && (
                <option value={formData.concepto}>{formData.concepto}</option>
              )}
              {conceptos.filter(c => c.tipo === 'egreso').map((c) => (
                <option key={c.id} value={c.nombre}>{c.nombre}</option>
              ))}
            </select>
            <select
              value={formData.moneda}
              onChange={(e) => setFormData({...formData, moneda: e.target.value})}
              className="input-field"
              required
            >
              {monedas.map((m) => (
                <option key={m.code} value={m.code}>{m.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <select
              value={formData.tipo_transaccion}
              onChange={(e) => setFormData({...formData, tipo_transaccion: e.target.value})}
              className="input-field"
              required
            >
              {tiposTransaccion.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <select
              value={formData.ubicacion}
              onChange={(e) => setFormData({...formData, ubicacion: e.target.value})}
              className="input-field"
              required
            >
              {ubicaciones.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
            <select
              value={formData.templo}
              onChange={(e) => setFormData({...formData, templo: e.target.value})}
              className="input-field"
            >
              <option value="">Selecciona templo (opcional)</option>
              {templos.map((t) => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
          </div>

          <div className="mt-4">
            <input
              type="text"
              placeholder="Detalle/Observación (opcional)"
              value={formData.detalle}
              onChange={(e) => setFormData({...formData, detalle: e.target.value})}
              className="input-field w-full"
            />
          </div>

          <div className="mt-4">
            <input
              type="date"
              value={formData.fecha}
              onChange={(e) => setFormData({...formData, fecha: e.target.value})}
              className="input-field w-full"
            />
          </div>

          <button type="submit" className="btn-primary mt-4 w-full">
            {editingId ? 'Actualizar Egreso' : 'Guardar Egreso'}
          </button>
        </form>
      )}

      {/* Tabla de ingresos */}
      <div className="card">
        <h2 className="text-xl font-bold text-navy mb-4">Egresos ({filtrados.length.toLocaleString('es-AR')})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gold">
                <th className="text-left p-3 text-navy font-bold cursor-pointer select-none hover:bg-gold hover:bg-opacity-20 transition" onClick={() => handleSort('fecha')}>Fecha{flecha('fecha')}</th>
                <th className="text-left p-3 text-navy font-bold cursor-pointer select-none hover:bg-gold hover:bg-opacity-20 transition" onClick={() => handleSort('concepto')}>Concepto{flecha('concepto')}</th>
                <th className="text-left p-3 text-navy font-bold cursor-pointer select-none hover:bg-gold hover:bg-opacity-20 transition" onClick={() => handleSort('monto')}>Monto{flecha('monto')}</th>
                <th className="text-left p-3 text-navy font-bold cursor-pointer select-none hover:bg-gold hover:bg-opacity-20 transition" onClick={() => handleSort('moneda')}>Moneda{flecha('moneda')}</th>
                <th className="text-left p-3 text-navy font-bold cursor-pointer select-none hover:bg-gold hover:bg-opacity-20 transition" onClick={() => handleSort('tipo_transaccion')}>Tipo{flecha('tipo_transaccion')}</th>
                <th className="text-left p-3 text-navy font-bold cursor-pointer select-none hover:bg-gold hover:bg-opacity-20 transition" onClick={() => handleSort('ubicacion')}>Ubicación{flecha('ubicacion')}</th>
                <th className="text-left p-3 text-navy font-bold cursor-pointer select-none hover:bg-gold hover:bg-opacity-20 transition" onClick={() => handleSort('templo')}>Templo{flecha('templo')}</th>
                <th className="text-left p-3 text-navy font-bold cursor-pointer select-none hover:bg-gold hover:bg-opacity-20 transition" onClick={() => handleSort('detalle')}>Detalle{flecha('detalle')}</th>
                <th className="text-left p-3 text-navy font-bold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ordenados.length > 0 ? (
                paginados.map((ing, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="p-3">{parseFechaLocal(ing.fecha).toLocaleDateString('es-ES')}</td>
                    <td className="p-3 font-medium">{ing.concepto}</td>
                    <td className="p-3 font-bold text-red-600">{getMonedaSymbol(ing.moneda)} {ing.monto?.toLocaleString()}</td>
                    <td className="p-3">
                      <span className="font-semibold">
                        {ing.moneda === 'ARS' && '🇦🇷 ARS'}
                        {ing.moneda === 'USD' && '🇺🇸 USD'}
                        {ing.moneda === 'CLP' && '🇨🇱 CLP'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-800">
                        {tiposTransaccion.find(t => t.value === ing.tipo_transaccion)?.label || '—'}
                      </span>
                    </td>
                    <td className="p-3 text-xs">{ubicaciones.find(u => u.value === ing.ubicacion)?.label || '—'}</td>
                    <td className="p-3 text-xs">{ing.templo_id ? templos.find(t => t.id === ing.templo_id)?.nombre || '—' : '—'}</td>
                    <td className="p-3 text-gray-600">{ing.detalle || '—'}</td>
                    <td className="p-3 flex gap-2">
                      <button
                        onClick={() => handleEditEgreso(ing)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Editar"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteEgreso(ing.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Eliminar"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="p-6 text-center text-gray-500">
                    No hay egresos con los filtros seleccionados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* PAGINACIÓN */}
        {ordenados.length > POR_PAGINA && (
          <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t">
            <p className="text-sm text-gray-600">
              Mostrando {((pagina - 1) * POR_PAGINA + 1).toLocaleString('es-AR')}–{Math.min(pagina * POR_PAGINA, ordenados.length).toLocaleString('es-AR')} de {ordenados.length.toLocaleString('es-AR')} registros
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagina(1)}
                disabled={pagina === 1}
                className="px-3 py-2 rounded border text-navy font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gold hover:bg-opacity-20"
              >
                «
              </button>
              <button
                onClick={() => setPagina(p => Math.max(1, p - 1))}
                disabled={pagina === 1}
                className="px-3 py-2 rounded border text-navy font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gold hover:bg-opacity-20"
              >
                ‹ Anterior
              </button>
              <span className="px-3 py-2 text-sm font-bold text-navy">
                Página {pagina} de {totalPaginas}
              </span>
              <button
                onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                disabled={pagina === totalPaginas}
                className="px-3 py-2 rounded border text-navy font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gold hover:bg-opacity-20"
              >
                Siguiente ›
              </button>
              <button
                onClick={() => setPagina(totalPaginas)}
                disabled={pagina === totalPaginas}
                className="px-3 py-2 rounded border text-navy font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gold hover:bg-opacity-20"
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
