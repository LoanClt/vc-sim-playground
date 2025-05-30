import React, { useState } from 'react';
import { useVCFundStore, type PortfolioCompany } from '../lib/store';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Trash2, Plus, Edit, Save, X, AlertCircle } from 'lucide-react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from './ui/select';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { SimulatorControl } from './simulator';

// Stage badge variants - more subtle colors
export const getStageBadgeVariant = (stage: string) => {
  switch (stage) {
    case 'Pre-Seed':
      return 'bg-blue-100 text-blue-800 hover:bg-blue-100';
    case 'Seed':
      return 'bg-green-100 text-green-800 hover:bg-green-100';
    case 'Series A':
      return 'bg-purple-100 text-purple-800 hover:bg-purple-100';
    case 'Series B':
      return 'bg-orange-100 text-orange-800 hover:bg-orange-100';
    case 'Series C':
      return 'bg-red-100 text-red-800 hover:bg-red-100';
    default:
      return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
  }
};

export function StageBadge({ stage }: { stage: string }) {
  return (
    <Badge className={`font-medium ${getStageBadgeVariant(stage)}`}>
      {stage}
    </Badge>
  );
}

export function PortfolioManager() {
  const { 
    portfolioCompanies, 
    addPortfolioCompany, 
    removePortfolioCompany, 
    updatePortfolioCompany 
  } = useVCFundStore();
  
  const [editMode, setEditMode] = useState<string | null>(null);
  const [newCompany, setNewCompany] = useState<Omit<PortfolioCompany, 'id'>>({
    name: '',
    stage: 'Seed',
    checkSize: 1,
    valuation: 5,
    ownership: 20,
    entryDate: new Date(),
  });
  
  const [editCompany, setEditCompany] = useState<PortfolioCompany | null>(null);
  
  const stages = ['Pre-Seed', 'Seed', 'Series A', 'Series B', 'Series C'];
  
  // Add toggle for input mode
  const [inputMode, setInputMode] = useState<'checkSize' | 'ownership'>('checkSize');
  
  const handleAddCompany = () => {
    if (!newCompany.name) {
      toast.error("Please enter a company name");
      return;
    }
    if (!newCompany.valuation || newCompany.valuation <= 0) {
      toast.error("Valuation must be greater than 0");
      return;
    }
    if (inputMode === 'checkSize' && newCompany.checkSize <= 0) {
      toast.error("Check size must be greater than 0");
      return;
    }
    if (inputMode === 'ownership' && (newCompany.ownership <= 0 || newCompany.ownership > 100)) {
      toast.error("Ownership must be between 0 and 100");
      return;
    }
    // Calculate ownership or checkSize
    const ownership = (newCompany.checkSize / newCompany.valuation) * 100;
    const checkSize = (newCompany.ownership / 100) * newCompany.valuation;
    addPortfolioCompany({
      ...newCompany,
      ownership: inputMode === 'checkSize' ? ownership : newCompany.ownership,
      checkSize: inputMode === 'ownership' ? checkSize : newCompany.checkSize,
    });
    // Reset form
    setNewCompany({
      name: '',
      stage: 'Seed',
      checkSize: 1,
      valuation: 5,
      ownership: 20,
      entryDate: new Date(),
    });
    toast.success("Company added to portfolio");
  };
  
  const handleEditStart = (company: PortfolioCompany) => {
    setEditMode(company.id);
    setEditCompany({ ...company });
  };
  
  const handleEditCancel = () => {
    setEditMode(null);
    setEditCompany(null);
  };
  
  const handleEditSave = () => {
    if (!editCompany) return;
    
    if (!editCompany.name) {
      toast.error("Please enter a company name");
      return;
    }
    
    if (editCompany.checkSize <= 0) {
      toast.error("Check size must be greater than 0");
      return;
    }
    
    updatePortfolioCompany(editCompany.id, {
      name: editCompany.name,
      stage: editCompany.stage,
      checkSize: editCompany.checkSize,
      valuation: editCompany.valuation,
      ownership: editCompany.ownership,
      entryDate: editCompany.entryDate,
    });
    
    setEditMode(null);
    setEditCompany(null);
    
    toast.success("Company updated");
  };
  
  const handleRemoveCompany = (id: string) => {
    removePortfolioCompany(id);
    toast.success("Company removed from portfolio");
  };
  
  return (
    <div className="space-y-4">
      {/* Add new company form */}
      <Card className="p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-medium">Add New Company</h3>
        </div>
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={inputMode === 'ownership'}
                onChange={e => setInputMode(e.target.checked ? 'ownership' : 'checkSize')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:bg-blue-600 transition-all duration-200"></div>
              <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 peer-checked:translate-x-5"></div>
            </label>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="col-span-2">
            <label htmlFor="company-name" className="text-xs font-medium block mb-1">
              Company Name
            </label>
            <Input
              id="company-name"
              placeholder="Enter company name"
              value={newCompany.name}
              onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="company-stage" className="text-xs font-medium block mb-1">
              Stage
            </label>
            <Select
              value={newCompany.stage}
              onValueChange={(value) => setNewCompany({ ...newCompany, stage: value })}
            >
              <SelectTrigger id="company-stage">
                <SelectValue placeholder="Select stage" />
              </SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage} value={stage}>
                    {stage}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label htmlFor="company-valuation" className="text-xs font-medium block mb-1">
              Valuation ($MM)
            </label>
            <Input
              id="company-valuation"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="Enter valuation"
              value={newCompany.valuation}
              onChange={(e) => {
                const valuation = parseFloat(e.target.value) || 0;
                let checkSize = newCompany.checkSize;
                let ownership = newCompany.ownership;
                if (inputMode === 'checkSize') {
                  ownership = valuation > 0 ? (checkSize / valuation) * 100 : 0;
                } else {
                  checkSize = (ownership / 100) * valuation;
                }
                setNewCompany({ ...newCompany, valuation, checkSize, ownership });
              }}
            />
          </div>
          {inputMode === 'checkSize' ? (
            <>
              <div>
                <label htmlFor="company-checksize" className="text-xs font-medium block mb-1">
                  Check Size ($MM)
                </label>
                <Input
                  id="company-checksize"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Enter check size"
                  value={newCompany.checkSize}
                  onChange={(e) => {
                    const checkSize = parseFloat(e.target.value) || 0;
                    const ownership = newCompany.valuation > 0 ? (checkSize / newCompany.valuation) * 100 : 0;
                    setNewCompany({ ...newCompany, checkSize, ownership });
                  }}
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">
                  Ownership (%)
                </label>
                <Input
                  type="number"
                  value={newCompany.ownership.toFixed(2)}
                  readOnly
                  className="bg-gray-100 cursor-not-allowed"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-xs font-medium block mb-1">
                  Ownership (%)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="100"
                  placeholder="Enter ownership %"
                  value={newCompany.ownership}
                  onChange={(e) => {
                    const ownership = parseFloat(e.target.value) || 0;
                    const checkSize = newCompany.valuation > 0 ? (ownership / 100) * newCompany.valuation : 0;
                    setNewCompany({ ...newCompany, ownership, checkSize });
                  }}
                />
              </div>
              <div>
                <label htmlFor="company-checksize" className="text-xs font-medium block mb-1">
                  Check Size ($MM)
                </label>
                <Input
                  id="company-checksize"
                  type="number"
                  value={newCompany.checkSize.toFixed(2)}
                  readOnly
                  className="bg-gray-100 cursor-not-allowed"
                />
              </div>
            </>
          )}
          {/* Alert if check size > valuation */}
          {newCompany.checkSize > newCompany.valuation && (
            <div className="col-span-2 mt-2 p-2 bg-red-100 text-red-700 rounded text-xs text-center border border-red-200 flex items-center justify-center gap-2">
              <AlertCircle className="inline-block h-4 w-4 mr-1 text-red-500" />
              Check Size cannot be greater than Valuation.
            </div>
          )}
        </div>
        
        <Button 
          onClick={handleAddCompany}
          className="w-full flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Company
        </Button>
      </Card>
      
      {/* Portfolio companies list */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">
          Portfolio Companies ({portfolioCompanies.length})
        </h3>
        
        {portfolioCompanies.length === 0 ? (
          <div className="p-6 text-center text-gray-500 bg-gray-100 rounded-md">
            No companies in your portfolio yet.
          </div>
        ) : (
          <div className="space-y-2">
            {portfolioCompanies.map((company) => (
              <Card key={company.id} className="p-3">
                {editMode === company.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="col-span-2">
                        <label className="text-xs font-medium block mb-1">
                          Company Name
                        </label>
                        <Input
                          placeholder="Enter company name"
                          value={editCompany?.name || ""}
                          onChange={(e) => 
                            setEditCompany(
                              editCompany ? { ...editCompany, name: e.target.value } : null
                            )
                          }
                        />
                      </div>
                      
                      <div>
                        <label className="text-xs font-medium block mb-1">
                          Stage
                        </label>
                        <Select
                          value={editCompany?.stage || "Seed"}
                          onValueChange={(value) => 
                            setEditCompany(
                              editCompany ? { ...editCompany, stage: value } : null
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select stage" />
                          </SelectTrigger>
                          <SelectContent>
                            {stages.map((stage) => (
                              <SelectItem key={stage} value={stage}>
                                {stage}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <label className="text-xs font-medium block mb-1">
                          Check Size ($MM)
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="Enter check size"
                          value={editCompany?.checkSize || 0}
                          onChange={(e) => 
                            setEditCompany(
                              editCompany 
                                ? { ...editCompany, checkSize: parseFloat(e.target.value) || 0, ownership: (editCompany.valuation > 0 ? (parseFloat(e.target.value) / editCompany.valuation) * 100 : 0) } 
                                : null
                            )
                          }
                        />
                      </div>
                      
                      <div>
                        <label className="text-xs font-medium block mb-1">
                          Valuation ($MM)
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="Enter valuation"
                          value={editCompany?.valuation || 0}
                          onChange={(e) => 
                            setEditCompany(
                              editCompany 
                                ? { ...editCompany, valuation: parseFloat(e.target.value) || 0, ownership: ((parseFloat(e.target.value) > 0) ? (editCompany.checkSize / parseFloat(e.target.value)) * 100 : 0) } 
                                : null
                            )
                          }
                        />
                      </div>
                      
                      <div>
                        <label className="text-xs font-medium block mb-1">
                          Ownership (%)
                        </label>
                        <Input
                          type="number"
                          value={editCompany?.ownership?.toFixed(2) || "0.00"}
                          readOnly
                          className="bg-gray-100 cursor-not-allowed"
                        />
                      </div>
                    </div>
                    
                    <div className="flex justify-end gap-2 mt-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleEditCancel}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                      <Button 
                        size="sm"
                        onClick={handleEditSave}
                      >
                        <Save className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{company.name}</h4>
                        <StageBadge stage={company.stage} />
                      </div>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEditStart(company)}
                        >
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-red-500 hover:text-red-600"
                          onClick={() => handleRemoveCompany(company.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Remove</span>
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Check Size:</span>
                        <span>{company.checkSize.toFixed(2)}$MM</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Valuation:</span>
                        <span>{company.valuation.toFixed(2)}$MM</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Ownership:</span>
                        <span>{company.ownership.toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}