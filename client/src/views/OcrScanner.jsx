import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { UploadCloud, CheckCircle, Loader2, Sparkles, Tag, AlertCircle, ArrowRight } from 'lucide-react';

export default function OcrScanner() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanLogs, setScanLogs] = useState([]);
  const [success, setSuccess] = useState(false);
  const [savedTransaction, setSavedTransaction] = useState(null);
  const [fileError, setFileError] = useState('');
  const [scanEngine, setScanEngine] = useState('');
  const [parsedItems, setParsedItems] = useState([]);
  const [formError, setFormError] = useState('');
  const fileInputRef = useRef(null);

  // Parsed receipt state
  const [form, setForm] = useState({
    description: '',
    amount: '',
    category: 'Miscellaneous',
    paymentMethod: 'Cash',
    date: '',
    merchant: '',
    receiptUrl: '',
    notes: ''
  });

  const [saving, setSaving] = useState(false);

  const addLog = (message) => {
    setScanLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const resetForm = () => {
    setForm({
      description: '',
      amount: '',
      category: 'Miscellaneous',
      paymentMethod: 'Cash',
      date: '',
      merchant: '',
      receiptUrl: '',
      notes: ''
    });
    setParsedItems([]);
    setScanEngine('');
    setFormError('');
  };

  const selectFile = (file) => {
    const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    const hasSupportedExt = /\.(jpe?g|png|webp|avif|heic)$/i.test(file.name);
    
    if (!supportedTypes.includes(file.type) && !hasSupportedExt && !file.type.startsWith('image/')) {
      setFileError('Please upload a valid receipt image (JPG, PNG, WebP, or AVIF).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFileError('Receipt images must be 10 MB or smaller.');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setSuccess(false);
    setSavedTransaction(null);
    setFileError('');
    resetForm();
    setScanLogs([]);
    addLog(`Selected receipt: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
  };

  const handleFileChange = (e) => {
    const [file] = e.target.files;
    if (file) selectFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const [file] = e.dataTransfer.files;
    if (file) selectFile(file);
  };

  const triggerFileSelect = () => {
    fileInputRef.current.click();
  };

  const runOcrScan = async () => {
    if (!selectedFile) return;

    try {
      setScanning(true);
      setScanLogs([]);
      setFileError('');
      setFormError('');

      addLog('Uploading receipt image to backend...');
      
      const formData = new FormData();
      formData.append('receipt', selectedFile);

      addLog('Extracting merchant, items, amount, and date via AI vision engine...');

      const res = await fetch('/api/ocr/scan', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        const engineLabel = data.engine === 'gemini-vision' ? 'Gemini AI Vision' : 'Tesseract OCR + Neural Parser';
        setScanEngine(engineLabel);
        addLog(`Receipt processed successfully with ${engineLabel}!`);

        const itemsList = Array.isArray(data.items) ? data.items : [];
        setParsedItems(itemsList);

        setForm({
          description: `Receipt from ${data.merchant || 'Store'}`,
          amount: data.amount > 0 ? data.amount : '',
          category: data.category || 'Miscellaneous',
          paymentMethod: 'Cash',
          date: data.date || new Date().toISOString().split('T')[0],
          merchant: data.merchant !== 'Receipt Store' ? (data.merchant || '') : '',
          receiptUrl: data.receiptUrl || '',
          notes: itemsList.length > 0 
            ? `Items: ${itemsList.join(', ')}` 
            : (data.rawText ? data.rawText.slice(0, 150) : '')
        });
      } else {
        const errData = await res.json().catch(() => ({}));
        addLog(`Error: ${errData.error || 'Failed to scan receipt.'}`);
        setFileError(errData.error || 'Failed to scan receipt image.');
      }
    } catch (err) {
      console.error(err);
      addLog('Scanning aborted: Server connection error.');
      setFileError('Unable to connect to server. Please ensure the backend is running.');
    } finally {
      setScanning(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (formError) setFormError('');
  };

  const handleSubmitTransaction = async (e) => {
    e.preventDefault();
    if (!form.merchant || !form.merchant.trim()) {
      setFormError('Please enter a merchant name.');
      return;
    }
    const numAmount = parseFloat(form.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError('Please enter a valid positive amount.');
      return;
    }

    try {
      setSaving(true);
      setFormError('');
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          amount: numAmount
        })
      });
      if (res.ok) {
        const savedData = await res.json();
        setSavedTransaction(savedData);
        setSuccess(true);
        setSelectedFile(null);
        setPreviewUrl(null);
        setScanLogs([]);
      } else {
        const errData = await res.json().catch(() => ({}));
        setFormError(errData.error || 'Failed to save transaction.');
      }
    } catch (err) {
      console.error(err);
      setFormError('Server error while saving transaction.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="view-header">
        <div className="view-title-container">
          <h1 className="view-title">Receipt OCR Scanner</h1>
          <p className="view-subtitle">Upload purchase receipts to auto-populate transactional entries.</p>
        </div>
      </div>

      {success && savedTransaction ? (
        <div className="card card-glowing" style={{ textAlign: 'center', padding: '40px', maxWidth: '600px', margin: '40px auto' }}>
          <CheckCircle size={56} color="var(--color-success)" style={{ marginBottom: '16px' }} />
          <h2>Transaction Logged Successfully!</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px', marginBottom: '24px' }}>
            The receipt details have been parsed and securely saved into your ledger database.
          </p>

          <div style={{ background: 'var(--bg-card-hover)', borderRadius: '8px', padding: '16px 20px', textAlign: 'left', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Merchant:</span>
              <strong>{savedTransaction.merchant || 'General Merchant'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Amount:</span>
              <strong style={{ color: 'var(--color-primary)' }}>₹{Number(savedTransaction.amount).toFixed(2)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Transaction Date:</span>
              <span>{savedTransaction.date ? new Date(savedTransaction.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Category:</span>
              <span className="badge badge-food" style={{ padding: '4px 10px' }}>{savedTransaction.category}</span>
            </div>
          </div>

          {savedTransaction.date && savedTransaction.date.slice(0, 7) !== new Date().toISOString().slice(0, 7) && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '12px 14px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '6px', color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'left', marginBottom: '24px' }}>
              <AlertCircle size={16} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>
                Note: This receipt has a recorded date of <strong>{savedTransaction.date.slice(0, 10)}</strong>. Clicking <strong>View in Transaction Ledger</strong> below will automatically show all records so you see it right away.
              </span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <Link 
              to={`/transactions?search=${encodeURIComponent(savedTransaction.merchant || '')}&month=all&sortBy=createdAt`} 
              className="btn btn-primary"
              style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              View in Transaction Ledger <ArrowRight size={16} />
            </Link>
            <button className="btn btn-secondary" onClick={() => { setSuccess(false); setSavedTransaction(null); resetForm(); }}>
              Scan Another Receipt
            </button>
          </div>
        </div>
      ) : (
        <div className="ocr-layout">
          {/* Left Side: Upload & Scan Preview */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Receipt Source</h3>
              {scanEngine && (
                <span className="badge badge-accent" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                  <Sparkles size={12} /> {scanEngine}
                </span>
              )}
            </div>
            
            {!previewUrl ? (
              <div 
                className="dropzone-container" 
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={triggerFileSelect}
              >
                <UploadCloud className="dropzone-icon" />
                <p style={{ fontWeight: '600', marginBottom: '8px' }}>Drag & Drop Receipt Image</p>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Supports JPG, JPEG, PNG, WebP, AVIF (Max 10MB)</p>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="image/jpeg,image/png,image/webp,image/avif,image/*"
                  style={{ display: 'none' }} 
                />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="scan-preview-wrapper">
                  <img src={previewUrl} className="scan-image" alt="Receipt Preview" />
                  {scanning && <div className="scanning-laser"></div>}
                </div>
                
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button className="btn btn-secondary" onClick={() => { setSelectedFile(null); setPreviewUrl(null); setScanLogs([]); setFileError(''); resetForm(); }} disabled={scanning}>
                    Remove
                  </button>
                  <button className="btn btn-primary" style={{ flexGrow: 1 }} onClick={runOcrScan} disabled={scanning}>
                    {scanning ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> Scanning receipt...
                      </>
                    ) : 'Analyze Receipt'}
                  </button>
                </div>
              </div>
            )}

            {fileError && <p className="form-error" role="alert">{fileError}</p>}

            {/* Line items tags chip preview */}
            {parsedItems.length > 0 && (
              <div style={{ padding: '12px', background: 'var(--bg-card-hover)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  <Tag size={13} /> Extracted Items ({parsedItems.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {parsedItems.map((item, i) => (
                    <span key={i} className="badge badge-neutral" style={{ fontSize: '12px' }}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Live progress logs terminal */}
            {scanLogs.length > 0 && (
              <div>
                <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Console Logs</h4>
                <div className="logs-container">
                  {scanLogs.map((log, idx) => (
                    <div key={idx} style={{ marginBottom: '4px' }}>{log}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Side: Structured Receipt Form */}
          <div className="card">
            <h3>Verified Data Details</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
              Verify and adjust the auto-parsed receipt fields before confirming.
            </p>

            {formError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '6px', color: '#f87171', marginBottom: '16px', fontSize: '13px' }}>
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitTransaction}>
              <div className="form-group">
                <label>Merchant *</label>
                <input 
                  type="text" 
                  name="merchant" 
                  value={form.merchant} 
                  onChange={handleInputChange}
                  placeholder="e.g. Starbucks, Blue Dart"
                  required
                  disabled={scanning}
                />
              </div>

              <div className="form-group">
                <label>Description / Name *</label>
                <input 
                  type="text" 
                  name="description" 
                  value={form.description} 
                  onChange={handleInputChange}
                  placeholder="e.g. Receipt Scan"
                  required
                  disabled={scanning}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Amount (₹) *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    name="amount" 
                    value={form.amount} 
                    onChange={handleInputChange}
                    placeholder="0.00"
                    required
                    disabled={scanning}
                  />
                </div>
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ margin: 0 }}>Date *</label>
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '11px', cursor: 'pointer', padding: '0 4px', fontWeight: '600' }}
                      onClick={() => setForm(prev => ({ ...prev, date: new Date().toISOString().split('T')[0] }))}
                      disabled={scanning}
                    >
                      Use Today
                    </button>
                  </div>
                  <input 
                    type="date" 
                    name="date" 
                    value={form.date} 
                    onChange={handleInputChange}
                    required
                    disabled={scanning}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>
                  <select name="category" value={form.category} onChange={handleInputChange} disabled={scanning}>
                    <option value="Food & Dining">Food & Dining</option>
                    <option value="Transport & Auto">Transport & Auto</option>
                    <option value="Utilities & Bills">Utilities & Bills</option>
                    <option value="Shopping">Shopping</option>
                    <option value="Entertainment">Entertainment</option>
                    <option value="Healthcare & Fitness">Healthcare & Fitness</option>
                    <option value="Education">Education</option>
                    <option value="Travel">Travel</option>
                    <option value="Miscellaneous">Miscellaneous</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Payment Method</label>
                  <select name="paymentMethod" value={form.paymentMethod} onChange={handleInputChange} disabled={scanning}>
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="UPI">UPI</option>
                    <option value="NetBanking">NetBanking</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Items / Scanned Notes</label>
                <textarea 
                  name="notes" 
                  value={form.notes} 
                  onChange={handleInputChange}
                  placeholder="Scanned line items or additional notes..."
                  rows="3"
                  disabled={scanning}
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%', marginTop: '10px' }} 
                disabled={scanning || saving}
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Saving Transaction...
                  </>
                ) : 'Confirm & Save Transaction'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
