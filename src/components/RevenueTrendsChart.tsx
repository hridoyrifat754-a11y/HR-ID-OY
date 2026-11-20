import React, { useState, useMemo } from 'react';
import { BillRecord } from '../types';
import { formatCurrency, formatNum, formatMonthName, toBnDigits } from '../constants';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  AreaChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { TrendingUp, BarChart3, AreaChart as AreaIcon, Layers } from 'lucide-react';

interface RevenueTrendsChartProps {
  bills: BillRecord[];
  selectedMonth: string;
  useBn: boolean;
}

export const RevenueTrendsChart: React.FC<RevenueTrendsChartProps> = ({
  bills,
  selectedMonth,
  useBn,
}) => {
  const [chartType, setChartType] = useState<'composed' | 'bar' | 'area'>('composed');

  // Compute the 6-month sequence ending at selectedMonth
  const chartData = useMemo(() => {
    let baseYear: number;
    let baseMonth: number;

    if (selectedMonth && selectedMonth.includes('-')) {
      const parts = selectedMonth.split('-').map(Number);
      baseYear = parts[0];
      baseMonth = parts[1]; // 1-12
    } else {
      const now = new Date();
      baseYear = now.getFullYear();
      baseMonth = now.getMonth() + 1;
    }

    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(baseYear, baseMonth - 1 - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    return months.map((mStr) => {
      const monthBills = bills.filter((b) => b.month === mStr);
      const revenue = monthBills.reduce((acc, b) => acc + (b.total || 0), 0);
      const collection = monthBills.reduce((acc, b) => acc + (b.paid || 0), 0);
      const due = monthBills.reduce((acc, b) => acc + (b.due || 0), 0);
      const collectionRate = revenue > 0 ? Math.round((collection / revenue) * 100) : 0;

      // Clean label
      const fullLabel = formatMonthName(mStr, useBn);
      const [year, month] = mStr.split('-');
      const shortMonth = fullLabel.split(' ')[0] || mStr;
      const shortYear = useBn ? toBnDigits(year.slice(2)) : year.slice(2);
      const displayLabel = `${shortMonth} '${shortYear}`;

      return {
        monthKey: mStr,
        displayLabel,
        fullLabel,
        revenue,
        collection,
        due,
        collectionRate,
        billCount: monthBills.length,
      };
    });
  }, [bills, selectedMonth, useBn]);

  // Aggregate totals for the 6-month window
  const aggregates = useMemo(() => {
    const totalRev = chartData.reduce((acc, d) => acc + d.revenue, 0);
    const totalColl = chartData.reduce((acc, d) => acc + d.collection, 0);
    const totalDue = chartData.reduce((acc, d) => acc + d.due, 0);
    const avgRate = totalRev > 0 ? Math.round((totalColl / totalRev) * 100) : 0;
    return { totalRev, totalColl, totalDue, avgRate };
  }, [chartData]);

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl border border-slate-700 text-xs font-sans min-w-[200px]">
          <div className="font-bold text-slate-200 border-b border-slate-800 pb-1.5 mb-2">
            {data.fullLabel} ({formatNum(data.billCount, useBn)}টি রুম)
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-blue-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block"></span>
                <span>মোট বিল দাবি (Revenue):</span>
              </span>
              <strong className="font-mono tabular-nums">{formatCurrency(data.revenue, useBn)}</strong>
            </div>
            <div className="flex items-center justify-between text-emerald-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block"></span>
                <span>মোট আদায় (Collection):</span>
              </span>
              <strong className="font-mono tabular-nums">{formatCurrency(data.collection, useBn)}</strong>
            </div>
            <div className="flex items-center justify-between text-rose-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block"></span>
                <span>বকেয়া (Due):</span>
              </span>
              <strong className="font-mono tabular-nums">{formatCurrency(data.due, useBn)}</strong>
            </div>
            <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span>আদায় হার:</span>
              <span className="font-mono font-bold text-white">
                {formatNum(data.collectionRate, useBn)}%
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const formatYTick = (val: number) => {
    if (val === 0) return useBn ? '৳০' : '৳0';
    if (val >= 1000) {
      const kVal = Math.round(val / 1000);
      return `৳${formatNum(kVal, useBn)}k`;
    }
    return `৳${formatNum(val, useBn)}`;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
      
      {/* Chart Header & Controls */}
      <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-sm sm:text-base text-slate-900">
              বিগত ৬ মাসের আয়, আদায় ও বকেয়া ট্রেন্ড (Revenue & Collection Trends)
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            প্রতি মাসের ভাড়া ও বিদ্যুৎ বিল দাবি, সংগৃহীত টাকা ও বকেয়া পরিবর্তনের তুলনামূলক চিত্র
          </p>
        </div>

        {/* Chart View Mode Segmented Controls */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
          <button
            onClick={() => setChartType('composed')}
            className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
              chartType === 'composed'
                ? 'bg-white font-bold text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>কম্বাইন্ড বার+লাইন</span>
          </button>
          <button
            onClick={() => setChartType('bar')}
            className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
              chartType === 'bar'
                ? 'bg-white font-bold text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>বার চার্ট</span>
          </button>
          <button
            onClick={() => setChartType('area')}
            className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
              chartType === 'area'
                ? 'bg-white font-bold text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <AreaIcon className="w-3.5 h-3.5" />
            <span>এরিয়া ট্রেন্ড</span>
          </button>
        </div>
      </div>

      {/* 6-Month Summary KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-x divide-y md:divide-y-0 divide-slate-100 bg-slate-50/60 border-b border-slate-200">
        <div className="p-3.5">
          <span className="text-[11px] text-slate-500 block">৬ মাসের মোট বিল দাবি</span>
          <span className="text-base sm:text-lg font-bold text-slate-900 font-mono tabular-nums">
            {formatCurrency(aggregates.totalRev, useBn)}
          </span>
        </div>
        <div className="p-3.5">
          <span className="text-[11px] text-slate-500 block">৬ মাসের মোট আদায়</span>
          <span className="text-base sm:text-lg font-bold text-emerald-700 font-mono tabular-nums">
            {formatCurrency(aggregates.totalColl, useBn)}
          </span>
        </div>
        <div className="p-3.5">
          <span className="text-[11px] text-slate-500 block">৬ মাসের অবশিষ্ট বকেয়া</span>
          <span className="text-base sm:text-lg font-bold text-rose-600 font-mono tabular-nums">
            {formatCurrency(aggregates.totalDue, useBn)}
          </span>
        </div>
        <div className="p-3.5">
          <span className="text-[11px] text-slate-500 block">গড় আদায় হার (Average)</span>
          <span className="text-base sm:text-lg font-bold text-blue-700 font-mono tabular-nums">
            {formatNum(aggregates.avgRate, useBn)}%
          </span>
        </div>
      </div>

      {/* Fresh start zero notice if no bills recorded */}
      {aggregates.totalRev === 0 && (
        <div className="px-5 py-2.5 bg-blue-50/70 border-b border-blue-100 flex items-center justify-between text-xs text-blue-800">
          <span>✨ বর্তমানে সকল ব্যালেন্স ও টাকার অংক শূন্য (০) রয়েছে। নতুন মাসিক বিল তৈরি করা হলে চার্টে স্বয়ংক্রিয়ভাবে গ্রাফ ফুটে উঠবে।</span>
        </div>
      )}

      {/* Chart Canvas */}
      <div className="p-4 sm:p-6">
        <div className="h-72 sm:h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'composed' ? (
              <ComposedChart data={chartData} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="displayLabel"
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, (dataMax: number) => (dataMax > 0 ? Math.ceil(dataMax * 1.1) : 10000)]}
                  tickFormatter={formatYTick}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  height={36}
                  formatter={(value) => {
                    const labels: Record<string, string> = {
                      revenue: 'মোট দাবি (Revenue)',
                      collection: 'মোট আদায় (Collection)',
                      due: 'বকেয়া (Due)',
                    };
                    return <span className="text-xs text-slate-700 font-medium">{labels[value] || value}</span>;
                  }}
                />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={38} name="revenue" />
                <Bar dataKey="collection" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={38} name="collection" />
                <Line
                  type="monotone"
                  dataKey="due"
                  stroke="#ef4444"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#ef4444', strokeWidth: 1.5, stroke: '#ffffff' }}
                  activeDot={{ r: 6 }}
                  name="due"
                />
              </ComposedChart>
            ) : chartType === 'bar' ? (
              <BarChart data={chartData} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="displayLabel"
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, (dataMax: number) => (dataMax > 0 ? Math.ceil(dataMax * 1.1) : 10000)]}
                  tickFormatter={formatYTick}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  height={36}
                  formatter={(value) => {
                    const labels: Record<string, string> = {
                      revenue: 'মোট দাবি (Revenue)',
                      collection: 'মোট আদায় (Collection)',
                      due: 'বকেয়া (Due)',
                    };
                    return <span className="text-xs text-slate-700 font-medium">{labels[value] || value}</span>;
                  }}
                />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={32} name="revenue" />
                <Bar dataKey="collection" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} name="collection" />
                <Bar dataKey="due" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={32} name="due" />
              </BarChart>
            ) : (
              <AreaChart data={chartData} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorColl" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorDue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="displayLabel"
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, (dataMax: number) => (dataMax > 0 ? Math.ceil(dataMax * 1.1) : 10000)]}
                  tickFormatter={formatYTick}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  height={36}
                  formatter={(value) => {
                    const labels: Record<string, string> = {
                      revenue: 'মোট দাবি (Revenue)',
                      collection: 'মোট আদায় (Collection)',
                      due: 'বকেয়া (Due)',
                    };
                    return <span className="text-xs text-slate-700 font-medium">{labels[value] || value}</span>;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRev)"
                  name="revenue"
                />
                <Area
                  type="monotone"
                  dataKey="collection"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorColl)"
                  name="collection"
                />
                <Area
                  type="monotone"
                  dataKey="due"
                  stroke="#ef4444"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorDue)"
                  name="due"
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
};
