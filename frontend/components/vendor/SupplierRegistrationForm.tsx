'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/hooks/useAuth';
import { 
  Building2, UserCheck, ShieldCheck, Factory, FileSignature, 
  CheckCircle2, AlertCircle, Save, ChevronRight, ChevronLeft, CreditCard, Plus, Trash2,
  FileText // Added QMS Icon
} from 'lucide-react';

const CATEGORIES = [
  { code: 'MFG', name: 'Ex-Works Supply / Manufacturing' },
  { code: 'RAW', name: 'Raw Materials' },
  { code: 'PKG', name: 'Packaging Materials' },
  { code: 'ENG', name: 'Factory Design & Engineering' },
  { code: 'SVC', name: 'Service Works (Maintenance & Repair)' },
  { code: 'LOG', name: 'Service Delivery / Logistics' },
  { code: 'CON', name: 'Consultancy & Technical Advisory' },
  { code: 'ICT', name: 'IT & Technology' },
  { code: 'FIN', name: 'Financial & Professional Services' },
  { code: 'FAC', name: 'Facilities & Property' },
  { code: 'MKT', name: 'Marketing & Media' },
  { code: 'OTH', name: 'Other' },
];

export default function SupplierRegistrationForm() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    legal_name: '',
    trading_name: '',
    registered_address: '',
    year_established: '',
    company_reg_no: '',
    vat_number: '',
    primary_category: '',
    all_categories: [] as string[],
    
    contacts: [{ full_name: '', position: '', telephone: '', email: '', is_primary: true }],
    
    references: [
      { company_name: '', contact_name: '', contact_details: '', reference_type: 'trade' },
      { company_name: '', contact_name: '', contact_details: '', reference_type: 'trade' }
    ],

    compliance_data: {
      has_qms: false, qms_standard: '', has_hse_policy: false, 
      has_safety_certs: false, is_regulatory_compliant: true, 
      sanctions_history: false, sanctions_details: ''
    },
    capabilities_data: {
      lead_time: '', max_capacity: '', geographic_areas: '', 
      uses_subcontractors: false, subcontractor_details: ''
    },
    
    banking_data: [{
      acc_name: '', acc_number: '', bank_name: '', branch_name: '', sort_code: '', swift_code: '', currency: 'ZMW'
    }],
    
    declaration_data: {
      signatory_name: '', signatory_position: '', declaration_date: new Date().toISOString().split('T')[0]
    }
  });

  const tabs = [
    { title: 'Company Details', icon: Building2 },
    { title: 'Scope & Contacts', icon: UserCheck },
    { title: 'Compliance & QA', icon: ShieldCheck },
    { title: 'Capabilities & References', icon: Factory },
    { title: 'Banking & Declaration', icon: FileSignature }
  ];

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateNestedField = (section: keyof typeof formData, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [section]: { ...(prev[section] as any), [field]: value }
    }));
  };

  const updateBankingField = (index: number, field: string, value: string) => {
    const newBanking = [...formData.banking_data];
    newBanking[index] = { ...newBanking[index], [field]: value };
    setFormData(prev => ({ ...prev, banking_data: newBanking }));
  };

  const addBankAccount = () => {
    setFormData(prev => ({
      ...prev,
      banking_data: [...prev.banking_data, { acc_name: '', acc_number: '', bank_name: '', branch_name: '', sort_code: '', swift_code: '', currency: 'USD' }]
    }));
  };

  const removeBankAccount = (index: number) => {
    setFormData(prev => ({
      ...prev,
      banking_data: prev.banking_data.filter((_, i) => i !== index)
    }));
  };

  const toggleCategory = (code: string) => {
    setFormData(prev => {
      const isSelected = prev.all_categories.includes(code);
      let newCategories = isSelected 
        ? prev.all_categories.filter(c => c !== code)
        : [...prev.all_categories, code];
      
      return { 
        ...prev, 
        all_categories: newCategories,
        primary_category: newCategories.length === 1 ? newCategories[0] : prev.primary_category 
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!formData.legal_name || !formData.registered_address || !formData.primary_category) {
        throw new Error('Please fill in all required company fields and select a primary category.');
      }

      const response = await api.post('/suppliers', formData);
      setSuccess(true);
      
      await api.post(`/suppliers/${response.data.vendor_id}/submit`);
      
      setTimeout(() => {
        router.push('/vendor-management/suppliers');
      }, 2000);

    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to submit vendor registration');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-dark-800 border border-green-500/30 rounded-xl p-12 text-center">
        <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Registration Submitted!</h2>
        <p className="text-gray-400">The supplier has been successfully routed to QA for verification.</p>
        <p className="text-sm text-gray-500 mt-4">Redirecting to vendor list...</p>
      </div>
    );
  }

  return (
    <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden shadow-xl">
      
      {/* QMS INTEGRATED HEADER */}
      <div className="p-6 border-b border-dark-700 bg-dark-900/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6 text-primary-400" />
          <h2 className="text-xl font-bold text-white">Supplier Registration</h2>
        </div>
        <button 
          type="button" 
          onClick={() => window.open('/qms/documents?search=QA-PUR-VEN-SOP-002', '_blank')} 
          className="px-3 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
        >
          <FileText className="w-4 h-4"/> View Approval SOP
        </button>
      </div>

      <div className="flex border-b border-dark-700 overflow-x-auto">
        {tabs.map((tab, idx) => {
          const Icon = tab.icon;
          return (
            <button key={idx} onClick={() => setActiveTab(idx)} className={`flex items-center gap-2 px-6 py-4 font-medium text-sm whitespace-nowrap transition-colors ${activeTab === idx ? 'text-primary-400 border-b-2 border-primary-500 bg-dark-700/50' : 'text-gray-400 hover:text-white hover:bg-dark-700/30'}`}>
              <Icon className="w-4 h-4" />{tab.title}
            </button>
          );
        })}
      </div>

      <div className="p-8">
        {error && <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-400"><AlertCircle className="w-5 h-5 flex-shrink-0" /><p className="text-sm">{error}</p></div>}

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* TAB 1: COMPANY DETAILS */}
          {activeTab === 0 && (
            <div className="space-y-6 animate-in fade-in">
              <h3 className="text-lg font-semibold text-white mb-4 border-b border-dark-700 pb-2">Section 1: Company Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div><label className="block text-sm font-medium text-gray-400 mb-1">Legal Business Name *</label><input type="text" required value={formData.legal_name} onChange={(e) => updateField('legal_name', e.target.value)} className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white focus:border-primary-500" /></div>
                <div><label className="block text-sm font-medium text-gray-400 mb-1">Trading Name (If different)</label><input type="text" value={formData.trading_name} onChange={(e) => updateField('trading_name', e.target.value)} className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white focus:border-primary-500" /></div>
                <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-400 mb-1">Registered Physical Address *</label><textarea required value={formData.registered_address} onChange={(e) => updateField('registered_address', e.target.value)} className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white focus:border-primary-500 h-20" /></div>
                <div><label className="block text-sm font-medium text-gray-400 mb-1">Year Established</label><input type="number" value={formData.year_established} onChange={(e) => updateField('year_established', e.target.value)} className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white focus:border-primary-500" /></div>
                <div><label className="block text-sm font-medium text-gray-400 mb-1">Company Registration No.</label><input type="text" value={formData.company_reg_no} onChange={(e) => updateField('company_reg_no', e.target.value)} className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white focus:border-primary-500" /></div>
                <div><label className="block text-sm font-medium text-gray-400 mb-1">VAT / Tax ID Number</label><input type="text" value={formData.vat_number} onChange={(e) => updateField('vat_number', e.target.value)} className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white focus:border-primary-500" /></div>
              </div>
            </div>
          )}

          {/* TAB 2: SCOPE & CONTACTS */}
          {activeTab === 1 && (
            <div className="space-y-8 animate-in fade-in">
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 border-b border-dark-700 pb-2">Section 2: Scope of Supply</h3>
                <p className="text-sm text-gray-400 mb-4">Select all applicable categories. The primary category will dictate the VTL Supplier ID.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {CATEGORIES.map(cat => (
                    <label key={cat.code} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${formData.all_categories.includes(cat.code) ? 'bg-primary-500/10 border-primary-500' : 'bg-dark-900 border-dark-700 hover:border-dark-500'}`}>
                      <input type="checkbox" checked={formData.all_categories.includes(cat.code)} onChange={() => toggleCategory(cat.code)} className="mt-1" />
                      <div className="flex flex-col"><span className="text-sm font-medium text-white">{cat.name}</span><span className="text-xs text-gray-500">Code: {cat.code}</span></div>
                    </label>
                  ))}
                </div>
                {formData.all_categories.length > 1 && (
                  <div className="mt-4 p-4 bg-dark-900 rounded-lg border border-dark-700">
                    <label className="block text-sm font-medium text-primary-400 mb-2">Select Primary Category (For VTL-ID Generation)</label>
                    <select value={formData.primary_category} onChange={(e) => updateField('primary_category', e.target.value)} className="w-full px-4 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white focus:border-primary-500">
                      {formData.all_categories.map(code => {
                        const cat = CATEGORIES.find(c => c.code === code);
                        return <option key={code} value={code}>{cat?.name}</option>;
                      })}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-4 border-b border-dark-700 pb-2">Primary Contact Person</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div><label className="block text-sm text-gray-400 mb-1">Full Name</label><input type="text" required value={formData.contacts[0].full_name} onChange={(e) => { const newContacts = [...formData.contacts]; newContacts[0].full_name = e.target.value; updateField('contacts', newContacts); }} className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white" /></div>
                  <div><label className="block text-sm text-gray-400 mb-1">Position / Title</label><input type="text" value={formData.contacts[0].position} onChange={(e) => { const newContacts = [...formData.contacts]; newContacts[0].position = e.target.value; updateField('contacts', newContacts); }} className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white" /></div>
                  <div><label className="block text-sm text-gray-400 mb-1">Telephone</label><input type="tel" required value={formData.contacts[0].telephone} onChange={(e) => { const newContacts = [...formData.contacts]; newContacts[0].telephone = e.target.value; updateField('contacts', newContacts); }} className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white" /></div>
                  <div><label className="block text-sm text-gray-400 mb-1">Email</label><input type="email" required value={formData.contacts[0].email} onChange={(e) => { const newContacts = [...formData.contacts]; newContacts[0].email = e.target.value; updateField('contacts', newContacts); }} className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white" /></div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: COMPLIANCE & QA */}
          {activeTab === 2 && (
            <div className="space-y-6 animate-in fade-in">
              <h3 className="text-lg font-semibold text-white mb-4 border-b border-dark-700 pb-2">Section 4: Quality, Safety & Compliance</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center justify-between p-4 bg-dark-900 rounded-lg border border-dark-700">
                  <div><p className="text-white font-medium">Documented QMS?</p><p className="text-xs text-gray-500">Quality Management System</p></div>
                  <input type="checkbox" checked={formData.compliance_data.has_qms} onChange={(e) => updateNestedField('compliance_data', 'has_qms', e.target.checked)} className="w-5 h-5 rounded border-dark-600 text-primary-500" />
                </div>
                {formData.compliance_data.has_qms && (
                  <div><label className="block text-sm font-medium text-gray-400 mb-1">QMS Standard (e.g. ISO 9001)</label><input type="text" value={formData.compliance_data.qms_standard} onChange={(e) => updateNestedField('compliance_data', 'qms_standard', e.target.value)} className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white" /></div>
                )}
                
                <div className="flex items-center justify-between p-4 bg-dark-900 rounded-lg border border-dark-700"><div><p className="text-white font-medium">HSE Policy in place?</p></div><input type="checkbox" checked={formData.compliance_data.has_hse_policy} onChange={(e) => updateNestedField('compliance_data', 'has_hse_policy', e.target.checked)} className="w-5 h-5 rounded border-dark-600 text-primary-500" /></div>
                <div className="flex items-center justify-between p-4 bg-dark-900 rounded-lg border border-dark-700"><div><p className="text-white font-medium">Safety Training/Certs Available?</p></div><input type="checkbox" checked={formData.compliance_data.has_safety_certs} onChange={(e) => updateNestedField('compliance_data', 'has_safety_certs', e.target.checked)} className="w-5 h-5 rounded border-dark-600 text-primary-500" /></div>
                <div className="flex items-center justify-between p-4 bg-dark-900 rounded-lg border border-dark-700"><div><p className="text-white font-medium">Regulatory Compliant?</p></div><input type="checkbox" checked={formData.compliance_data.is_regulatory_compliant} onChange={(e) => updateNestedField('compliance_data', 'is_regulatory_compliant', e.target.checked)} className="w-5 h-5 rounded border-dark-600 text-primary-500" /></div>

                <div className="md:col-span-2 flex items-center justify-between p-4 bg-red-500/5 rounded-lg border border-red-500/20">
                  <div><p className="text-red-400 font-medium">Regulatory Sanctions?</p><p className="text-xs text-red-400/70">Has the vendor faced sanctions in the past 5 years?</p></div>
                  <input type="checkbox" checked={formData.compliance_data.sanctions_history} onChange={(e) => updateNestedField('compliance_data', 'sanctions_history', e.target.checked)} className="w-5 h-5 rounded border-red-500/50 text-red-500" />
                </div>
                {formData.compliance_data.sanctions_history && (
                  <div className="md:col-span-2"><label className="block text-sm font-medium text-red-400 mb-1">Sanction Details</label><textarea required value={formData.compliance_data.sanctions_details} onChange={(e) => updateNestedField('compliance_data', 'sanctions_details', e.target.value)} className="w-full px-4 py-2 bg-dark-900 border border-red-500/30 rounded-lg text-white h-20" placeholder="Please provide details..." /></div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: CAPABILITIES & REFERENCES */}
          {activeTab === 3 && (
            <div className="space-y-8 animate-in fade-in">
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 border-b border-dark-700 pb-2">Section 5: Capacity & Capability</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div><label className="block text-sm text-gray-400 mb-1">Average Lead Time for Delivery</label><input type="text" value={formData.capabilities_data.lead_time} onChange={(e) => updateNestedField('capabilities_data', 'lead_time', e.target.value)} placeholder="e.g. 14 days" className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white" /></div>
                  <div><label className="block text-sm text-gray-400 mb-1">Max Project Capacity (Value/Scale)</label><input type="text" value={formData.capabilities_data.max_capacity} onChange={(e) => updateNestedField('capabilities_data', 'max_capacity', e.target.value)} className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white" /></div>
                  <div><label className="block text-sm text-gray-400 mb-1">Geographic Areas Served</label><input type="text" value={formData.capabilities_data.geographic_areas} onChange={(e) => updateNestedField('capabilities_data', 'geographic_areas', e.target.value)} placeholder="e.g. Lusaka, Nationwide" className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white" /></div>
                  <div className="flex items-center justify-between p-4 bg-dark-900 rounded-lg border border-dark-700"><div><p className="text-white font-medium">Uses Subcontractors?</p></div><input type="checkbox" checked={formData.capabilities_data.uses_subcontractors} onChange={(e) => updateNestedField('capabilities_data', 'uses_subcontractors', e.target.checked)} className="w-5 h-5 rounded border-dark-600 text-primary-500" /></div>
                  {formData.capabilities_data.uses_subcontractors && (
                    <div className="md:col-span-2"><label className="block text-sm text-gray-400 mb-1">Subcontractor Details</label><textarea value={formData.capabilities_data.subcontractor_details} onChange={(e) => updateNestedField('capabilities_data', 'subcontractor_details', e.target.value)} className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white" /></div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-4 border-b border-dark-700 pb-2">Trade References (2 Required)</h3>
                <div className="space-y-4">
                  {[0, 1].map((idx) => (
                    <div key={idx} className="p-4 bg-dark-900 rounded-lg border border-dark-700">
                      <p className="text-primary-400 text-sm font-semibold mb-3">Reference {idx + 1}</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label className="block text-xs text-gray-400 mb-1">Company Name</label><input type="text" required value={formData.references[idx].company_name} onChange={(e) => { const newRefs = [...formData.references]; newRefs[idx].company_name = e.target.value; updateField('references', newRefs); }} className="w-full px-3 py-1.5 bg-dark-800 border border-dark-600 rounded text-sm text-white" /></div>
                        <div><label className="block text-xs text-gray-400 mb-1">Contact Name</label><input type="text" value={formData.references[idx].contact_name} onChange={(e) => { const newRefs = [...formData.references]; newRefs[idx].contact_name = e.target.value; updateField('references', newRefs); }} className="w-full px-3 py-1.5 bg-dark-800 border border-dark-600 rounded text-sm text-white" /></div>
                        <div><label className="block text-xs text-gray-400 mb-1">Phone / Email</label><input type="text" value={formData.references[idx].contact_details} onChange={(e) => { const newRefs = [...formData.references]; newRefs[idx].contact_details = e.target.value; updateField('references', newRefs); }} className="w-full px-3 py-1.5 bg-dark-800 border border-dark-600 rounded text-sm text-white" /></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: BANKING & DECLARATION */}
          {activeTab === 4 && (
            <div className="space-y-8 animate-in fade-in">
              <div>
                <div className="flex items-center justify-between border-b border-dark-700 pb-2 mb-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-gray-400" /> Banking Details (Finance Only)
                  </h3>
                  <button type="button" onClick={addBankAccount} className="text-sm px-3 py-1.5 bg-primary-600/20 hover:bg-primary-600/40 text-primary-400 rounded flex items-center gap-1 transition-colors">
                    <Plus className="w-4 h-4" /> Add Account
                  </button>
                </div>
                <p className="text-xs text-yellow-500/80 mb-4 bg-yellow-500/10 p-2 rounded inline-block">These details will be encrypted and visible only to authorized Finance users during PO creation.</p>
                
                <div className="space-y-6">
                  {formData.banking_data.map((bank, idx) => (
                    <div key={idx} className="bg-dark-900 border border-dark-700 rounded-lg p-5 relative">
                      {formData.banking_data.length > 1 && (
                        <button type="button" onClick={() => removeBankAccount(idx)} className="absolute top-4 right-4 text-red-400 hover:text-red-300 p-1 bg-red-400/10 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <h4 className="text-primary-400 text-sm font-semibold mb-3">Bank Account {idx + 1}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Currency</label>
                          <select value={bank.currency} onChange={(e) => updateBankingField(idx, 'currency', e.target.value)} className="w-full px-3 py-1.5 bg-dark-800 border border-dark-600 rounded text-sm text-white focus:border-primary-500">
                            <option value="ZMW">ZMW - Zambian Kwacha</option>
                            <option value="USD">USD - US Dollar</option>
                            <option value="EUR">EUR - Euro</option>
                            <option value="ZAR">ZAR - South African Rand</option>
                            <option value="GBP">GBP - British Pound</option>
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs text-gray-400 mb-1">Account Name</label>
                          <input type="text" value={bank.acc_name} onChange={(e) => updateBankingField(idx, 'acc_name', e.target.value)} className="w-full px-3 py-1.5 bg-dark-800 border border-dark-600 rounded text-sm text-white" />
                        </div>
                        <div><label className="block text-xs text-gray-400 mb-1">Account Number</label><input type="text" value={bank.acc_number} onChange={(e) => updateBankingField(idx, 'acc_number', e.target.value)} className="w-full px-3 py-1.5 bg-dark-800 border border-dark-600 rounded text-sm text-white" /></div>
                        <div><label className="block text-xs text-gray-400 mb-1">Bank Name</label><input type="text" value={bank.bank_name} onChange={(e) => updateBankingField(idx, 'bank_name', e.target.value)} className="w-full px-3 py-1.5 bg-dark-800 border border-dark-600 rounded text-sm text-white" /></div>
                        <div><label className="block text-xs text-gray-400 mb-1">Branch Name</label><input type="text" value={bank.branch_name} onChange={(e) => updateBankingField(idx, 'branch_name', e.target.value)} className="w-full px-3 py-1.5 bg-dark-800 border border-dark-600 rounded text-sm text-white" /></div>
                        <div><label className="block text-xs text-gray-400 mb-1">Sort Code</label><input type="text" value={bank.sort_code} onChange={(e) => updateBankingField(idx, 'sort_code', e.target.value)} className="w-full px-3 py-1.5 bg-dark-800 border border-dark-600 rounded text-sm text-white" /></div>
                        <div><label className="block text-xs text-gray-400 mb-1">SWIFT Code</label><input type="text" value={bank.swift_code} onChange={(e) => updateBankingField(idx, 'swift_code', e.target.value)} className="w-full px-3 py-1.5 bg-dark-800 border border-dark-600 rounded text-sm text-white" /></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-4 border-b border-dark-700 pb-2">Section 7: Declaration</h3>
                <p className="text-sm text-gray-400 mb-4">Transcription of the authorized signatory from the physical form.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div><label className="block text-sm text-gray-400 mb-1">Signatory Name</label><input type="text" required value={formData.declaration_data.signatory_name} onChange={(e) => updateNestedField('declaration_data', 'signatory_name', e.target.value)} className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white" /></div>
                  <div><label className="block text-sm text-gray-400 mb-1">Signatory Position</label><input type="text" required value={formData.declaration_data.signatory_position} onChange={(e) => updateNestedField('declaration_data', 'signatory_position', e.target.value)} className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white" /></div>
                  <div><label className="block text-sm text-gray-400 mb-1">Date Signed</label><input type="date" required value={formData.declaration_data.declaration_date} onChange={(e) => updateNestedField('declaration_data', 'declaration_date', e.target.value)} className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white" /></div>
                </div>
              </div>
            </div>
          )}

          {/* FOOTER NAVIGATION */}
          <div className="flex justify-between items-center pt-6 border-t border-dark-700 mt-8">
            <button type="button" onClick={() => setActiveTab(prev => Math.max(0, prev - 1))} disabled={activeTab === 0} className="px-4 py-2 text-gray-400 hover:text-white disabled:opacity-30 flex items-center gap-2"><ChevronLeft className="w-4 h-4" /> Previous</button>
            {activeTab < tabs.length - 1 ? (
              <button type="button" onClick={() => setActiveTab(prev => Math.min(tabs.length - 1, prev + 1))} className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium flex items-center gap-2">Next Section <ChevronRight className="w-4 h-4" /></button>
            ) : (
              <button type="submit" disabled={loading} className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold flex items-center gap-2 transition-transform hover:scale-105">
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-5 h-5" />} Submit for QA Review
              </button>
            )}
          </div>

        </form>
      </div>
    </div>
  );
}