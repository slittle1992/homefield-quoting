import React, { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function ImportPage() {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const navigate = useNavigate();

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please upload a .csv file');
      return;
    }

    setUploading(true);
    setResults(null);
    setPreviewData([]);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/import/wcad', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const data = res.data;
      setResults({
        totalRows: data.total_rows || 0,
        poolProperties: data.pool_properties || 0,
        newImports: data.new_imports || 0,
        duplicatesSkipped: data.duplicates_skipped || 0,
        errors: data.errors || 0,
      });
      setPreviewData(data.preview || []);
      toast.success(`Import complete: ${data.new_imports || 0} new properties`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Import failed');
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e) => {
    if (e.target.files?.[0]) {
      handleFile(e.target.files[0]);
    }
  };

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900">Import WCAD Data</h1>
            <p className="text-sm text-slate-500 mt-1">
              Upload a Williamson County Appraisal District CSV file to import pool properties.
            </p>
          </div>

          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
              dragActive
                ? 'border-blue-400 bg-blue-50'
                : 'border-slate-300 bg-white hover:border-slate-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <LoadingSpinner size="lg" />
                <p className="text-sm text-slate-600 font-medium">Processing CSV file...</p>
                <p className="text-xs text-slate-400">This may take a moment for large files</p>
              </div>
            ) : (
              <>
                <Upload className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-sm font-medium text-slate-700 mb-1">
                  Drag and drop your CSV file here
                </p>
                <p className="text-xs text-slate-400 mb-4">or click to browse</p>
                <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg cursor-pointer transition-colors">
                  <FileSpreadsheet className="w-4 h-4" />
                  Choose File
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleInputChange}
                    className="hidden"
                  />
                </label>
              </>
            )}
          </div>

          {results && (
            <div className="mt-6 space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Import Results</h2>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <ResultCard
                  icon={FileSpreadsheet}
                  label="Total Rows"
                  value={results.totalRows}
                  color="text-slate-600 bg-slate-50"
                />
                <ResultCard
                  icon={CheckCircle2}
                  label="Pool Properties"
                  value={results.poolProperties}
                  color="text-blue-600 bg-blue-50"
                />
                <ResultCard
                  icon={CheckCircle2}
                  label="New Imports"
                  value={results.newImports}
                  color="text-green-600 bg-green-50"
                />
                <ResultCard
                  icon={AlertCircle}
                  label="Duplicates"
                  value={results.duplicatesSkipped}
                  color="text-yellow-600 bg-yellow-50"
                />
                <ResultCard
                  icon={AlertCircle}
                  label="Errors"
                  value={results.errors}
                  color="text-red-600 bg-red-50"
                />
              </div>

              {previewData.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left px-4 py-3 font-medium text-slate-600">Address</th>
                          <th className="text-left px-4 py-3 font-medium text-slate-600">City</th>
                          <th className="text-left px-4 py-3 font-medium text-slate-600">ZIP</th>
                          <th className="text-left px-4 py-3 font-medium text-slate-600">Owner</th>
                          <th className="text-left px-4 py-3 font-medium text-slate-600">Pool Type</th>
                          <th className="text-left px-4 py-3 font-medium text-slate-600">Subdivision</th>
                          <th className="text-right px-4 py-3 font-medium text-slate-600">Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previewData.map((row, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-slate-900 font-medium">{row.address_street}</td>
                            <td className="px-4 py-3 text-slate-600">{row.address_city}</td>
                            <td className="px-4 py-3 text-slate-600">{row.address_zip}</td>
                            <td className="px-4 py-3 text-slate-600">{row.owner_name}</td>
                            <td className="px-4 py-3 text-slate-600">{row.pool_type}</td>
                            <td className="px-4 py-3 text-slate-600">{row.subdivision}</td>
                            <td className="px-4 py-3 text-slate-600 text-right">
                              {row.property_value ? `$${Number(row.property_value).toLocaleString()}` : '--'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => navigate('/admin')}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <MapPin className="w-4 h-4" />
                  View on Map
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function ResultCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
      <div className={`inline-flex p-2 rounded-lg mb-2 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
