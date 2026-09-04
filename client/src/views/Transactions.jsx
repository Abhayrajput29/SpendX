import React, { useState, useEffect } from 'react';
import { Search, Filter, Calendar, Edit2, Trash2, Plus, Sparkles } from 'lucide-react';

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);

  // Form states
  const [form, setForm] = useState({
    description: '',
    amount: '',
    category: '',
    paymentMethod: 'Cash',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    merchant: ''
  });
  const [saving, setSaving] = useState(false);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      let queryParams = [];
      if (search) queryParams.push(`search=${encodeURIComponent(search)}`);
      if (category) queryParams.push(`category=${encodeURIComponent(category)}`);
      if (month) queryParams.push(`month=${encodeURIComponent(month)}`);

      const queryStr = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
      const res = await fetch(`/api/transactions${queryStr}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
      }
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [search, category, month]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!form.description || !form.amount) return;

    try {
      setSaving(true);
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        setShowAddModal(false);
        resetForm();
        fetchTransactions();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleEditClick = (tx) => {
    setSelectedTx(tx);
    setForm({
      description: tx.description,
      amount: tx.amount,
      category: tx.category,
      paymentMethod: tx.paymentMethod || 'Cash',
      date: new Date(tx.date).toISOString().split('T')[0],
      notes: tx.notes || '',
      merchant: tx.merchant || ''
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTx) return;

    try {
      setSaving(true);
      const res = await fetch(`/api/transactions/${selectedTx._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        setShowEditModal(false);
        resetForm();
        fetchTransactions();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = async (id) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return;
    
    try {
      const res = await fetch(`/api/transactions/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchTransactions();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = () => {
    setForm({
      description: '',
      amount: '',
      category: '',
      paymentMethod: 'Cash',
      date: new Date().toISOString().split('T')[0],
      notes: '',
      merchant: ''
    });
    setSelectedTx(null);
  };

  const getBadgeClass = (category) => {
    const cat = category.toLowerCase();
    if (cat.includes('food')) return 'badge-food';
    if (cat.includes('transport') || cat.includes('auto')) return 'badge-transport';
    if (cat.includes('utility') || cat.includes('bill')) return 'badge-utilities';
    if (cat.includes('shopping')) return 'badge-shopping';
    if (cat.includes('entertainment')) return 'badge-entertainment';
    if (cat.includes('health') || cat.includes('fitness')) return 'badge-healthcare';
    if (cat.includes('education')) return 'badge-education';
    if (cat.includes('travel')) return 'badge-travel';
    return 'badge-misc';
  };

  return (
    <div>
      <div className="view-header">
        <div className="view-title-container">
          <h1 className="view-title">Transaction Ledger</h1>
          <p className="view-subtitle">Review, search, and update details of all expenditures.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowAddModal(true); }}>
          <Plus size={18} /> Add Record
        </button>
      </div>

      {/* Filters Toolbar */}
      <div className="card" style={{ padding: '16px', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flexGrow: 1, minWidth: '200px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '15px', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search description, merchant, notes..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', paddingLeft: '36px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Filter size={16} style={{ color: 'var(--text-muted)' }} />
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ padding: '10px 16px' }}>
            <option value="">All Categories</option>
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

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
          <input 
            type="month" 
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            style={{ padding: '8px 16px' }}
          />
          {month && (
            <button className="btn btn-secondary" onClick={() => setMonth('')} style={{ padding: '10px 12px' }}>
              Clear Month
            </button>
          )}
        </div>
      </div>

      {/* Ledger Table */}
      <div className="card" style={{ padding: '0px' }}>
        <div className="table-container">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Loading ledger data...</div>
          ) : transactions.length > 0 ? (
            <table className="transaction-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Merchant / Description</th>
                  <th>Category</th>
                  <th>Payment Method</th>
                  <th>Amount</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx._id}>
                    <td>{new Date(tx.date).toLocaleDateString()}</td>
                    <td>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <strong>{tx.merchant || 'General Merchant'}</strong>
                          {tx.isAutoCategorized && (
                            <Sparkles size={11} color="var(--color-primary)" title="Auto-categorized by AI" />
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{tx.description}</div>
                        {tx.notes && (
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                            Note: {tx.notes}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${getBadgeClass(tx.category)}`}>
                        {tx.category}
                      </span>
                    </td>
                    <td>{tx.paymentMethod}</td>
                    <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                      -₹{tx.amount.toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary" onClick={() => handleEditClick(tx)} style={{ padding: '6px 10px', borderRadius: 'var(--radius-sm)' }}>
                          <Edit2 size={13} />
                        </button>
                        <button className="btn btn-danger" onClick={() => handleDeleteClick(tx._id)} style={{ padding: '6px 10px', borderRadius: 'var(--radius-sm)' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-secondary)' }}>
              No transactions match the selected filters.
            </div>
          )}
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="card modal-content" style={{ padding: '30px', borderRadius: 'var(--radius-md)' }}>
            <h3 style={{ marginBottom: '20px' }}>Create Ledger Record</h3>
            
            <form onSubmit={handleAddSubmit}>
              <div className="form-group">
                <label>Description *</label>
                <input 
                  type="text" 
                  name="description" 
                  value={form.description} 
                  onChange={handleInputChange}
                  placeholder="e.g. Starbucks Latte or Taxi ride"
                  required
                />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  💡 Auto-categorization runs if category is left empty
                </span>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Merchant</label>
                  <input 
                    type="text" 
                    name="merchant" 
                    value={form.merchant} 
                    onChange={handleInputChange}
                    placeholder="e.g. Starbucks"
                  />
                </div>
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
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Date</label>
                  <input 
                    type="date" 
                    name="date" 
                    value={form.date} 
                    onChange={handleInputChange}
                  />
                </div>
                <div className="form-group">
                  <label>Payment Method</label>
                  <select name="paymentMethod" value={form.paymentMethod} onChange={handleInputChange}>
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="UPI">UPI</option>
                    <option value="NetBanking">NetBanking</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Category (Optional)</label>
                  <select name="category" value={form.category} onChange={handleInputChange}>
                    <option value="">Auto-Detect (AI)</option>
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
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea 
                  name="notes" 
                  value={form.notes} 
                  onChange={handleInputChange} 
                  placeholder="Additional details..."
                  rows="2"
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Creating...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="card modal-content" style={{ padding: '30px', borderRadius: 'var(--radius-md)' }}>
            <h3 style={{ marginBottom: '20px' }}>Edit Ledger Record</h3>
            
            <form onSubmit={handleEditSubmit}>
              <div className="form-group">
                <label>Description *</label>
                <input 
                  type="text" 
                  name="description" 
                  value={form.description} 
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Merchant</label>
                  <input 
                    type="text" 
                    name="merchant" 
                    value={form.merchant} 
                    onChange={handleInputChange}
                  />
                </div>
                <div className="form-group">
                  <label>Amount (₹) *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    name="amount" 
                    value={form.amount} 
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Date</label>
                  <input 
                    type="date" 
                    name="date" 
                    value={form.date} 
                    onChange={handleInputChange}
                  />
                </div>
                <div className="form-group">
                  <label>Payment Method</label>
                  <select name="paymentMethod" value={form.paymentMethod} onChange={handleInputChange}>
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="UPI">UPI</option>
                    <option value="NetBanking">NetBanking</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Category</label>
                  <select name="category" value={form.category} onChange={handleInputChange}>
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
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea 
                  name="notes" 
                  value={form.notes} 
                  onChange={handleInputChange} 
                  rows="2"
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Updating...' : 'Update Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
