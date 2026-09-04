import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle, HelpCircle, Loader2 } from 'lucide-react';

export default function OcrScanner() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanLogs, setScanLogs] = useState([]);
  const [success, setSuccess] = useState(false);
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

  const logIndexRef = useRef(0);
  const addLog = (message) => {
    setScanLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setSuccess(false);
      // Reset form
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
      setScanLogs([]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.match('image.*')) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setSuccess(false);
      setScanLogs([]);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current.click();
  };

  const runOcrScan = async () => {
    if (!selectedFile) return;

    try {
      setScanning(true);
      setScanLogs([]);
      
      // Simulate logs step-by-step to show the user a cool terminal interface
      addLog('Uploading receipt image to backend...');
      
      const formData = new FormData();
      formData.append('receipt', selectedFile);

      setTimeout(() => addLog('Starting Tesseract OCR engine...'), 800);
      setTimeout(() => addLog('Extracting characters and bounding boxes...'), 1800);
      setTimeout(() => addLog('Processing image text with FinanceAI algorithm...'), 3200);

      const res = await fetch('/api/ocr/scan', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        addLog('Receipt analyzed successfully! Populating form fields...');
        
        setForm({
          description: `Receipt from ${data.merchant || 'Merchant'}`,
          amount: data.amount || 0.00,
          category: data.category || 'Miscellaneous',
          paymentMethod: 'Cash',
          date: data.date || new Date().toISOString().split('T')[0],
          merchant: data.merchant || '',
          receiptUrl: data.receiptUrl || '',
          notes: data.items && data.items.length > 0 
            ? `Items: ${data.items.join(', ')}` 
            : `OCR scanned raw tokens parsed.`
        });
      } else {
        const errData = await res.json();
        addLog(`Error: ${errData.error || 'Failed to scan receipt.'}`);
      }
    } catch (err) {
      console.error(err);
      addLog('Scanning aborted: Server connection error.');
    } finally {
      setScanning(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmitTransaction = async (e) => {
    e.preventDefault();
    if (!form.merchant || !form.amount) return;

    try {
      setSaving(true);
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        setSuccess(true);
        setSelectedFile(null);
        setPreviewUrl(null);
        setScanLogs([]);
      }
    } catch (err) {
      console.error(err);
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

      {success ? (
        <div className="card card-glowing" style={{ textAlign: 'center', padding: '60px 40px', maxWidth: '600px', margin: '40px auto' }}>
          <CheckCircle size={64} color="var(--color-success)" style={{ marginBottom: '20px' }} />
          <h2>Transaction Logged Successfully!</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '10px', marginBottom: '30px' }}>
            The receipt details have been parsed, categorized, and added to your ledger database.
          </p>
          <button className="btn btn-primary" onClick={() => setSuccess(false)}>
            Scan Another Receipt
          </button>
        </div>
      ) : (
        <div className="ocr-layout">
          {/* Left Side: Upload & Scan Preview */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3>Receipt Source</h3>
            
            {!previewUrl ? (
              <div 
                className="dropzone-container" 
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={triggerFileSelect}
              >
                <UploadCloud className="dropzone-icon" />
                <p style={{ fontWeight: '600', marginBottom: '8px' }}>Drag & Drop Receipt Image</p>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Supports JPG, JPEG, PNG (Max 5MB)</p>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="image/*" 
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
                  <button className="btn btn-secondary" onClick={() => { setSelectedFile(null); setPreviewUrl(null); setScanLogs([]); }} disabled={scanning}>
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

            <form onSubmit={handleSubmitTransaction}>
              <div className="form-group">
                <label>Merchant *</label>
                <input 
                  type="text" 
                  name="merchant" 
                  value={form.merchant} 
                  onChange={handleInputChange}
                  placeholder="e.g. Walmart"
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
                  <label>Date *</label>
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
                  placeholder="Scanned line items..."
                  rows="3"
                  disabled={scanning}
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%', marginTop: '10px' }} 
                disabled={scanning || saving || !form.merchant || !form.amount}
              >
                {saving ? 'Saving...' : 'Confirm & Save Transaction'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
