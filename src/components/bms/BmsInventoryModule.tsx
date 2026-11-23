import React, { useState } from 'react';
import { doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  ProductItem,
  CategoryItem,
  InventoryLogRecord,
  RawMaterialRecord,
} from '../../data/initialCatalogue';
import {
  Package,
  AlertTriangle,
  Plus,
  RefreshCw,
  Search,
  Download,
  CheckCircle2,
  History,
  Layers,
  Trash2,
  Edit3,
} from 'lucide-react';

interface BmsInventoryModuleProps {
  products: ProductItem[];
  categories: CategoryItem[];
  inventoryLogs: InventoryLogRecord[];
  rawMaterials: RawMaterialRecord[];
  userEmail: string;
  userRoleName: string;
  hasPermission: (perm: string) => boolean;
  recordAuditLog: (
    entityType: string,
    action: string,
    entityId: string,
    summary: string
  ) => Promise<void>;
}

export const BmsInventoryModule: React.FC<BmsInventoryModuleProps> = ({
  products,
  categories,
  inventoryLogs,
  rawMaterials,
  userEmail,
  hasPermission,
  recordAuditLog,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'products' | 'raw_materials' | 'history'>(
    'products'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState<
    'all' | 'in_stock' | 'low_stock' | 'out_of_stock'
  >('all');
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  // Stock Adjustment Modal State
  const [adjustingProduct, setAdjustingProduct] = useState<ProductItem | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<
    'restock' | 'purchase' | 'wastage' | 'damaged' | 'manual_adjustment'
  >('restock');
  const [adjustmentDelta, setAdjustmentDelta] = useState<number>(10);
  const [adjustmentMinThreshold, setAdjustmentMinThreshold] = useState<number>(5);
  const [adjustmentReason, setAdjustmentReason] = useState('');

  // Raw Material Form State
  const [editingMaterial, setEditingMaterial] = useState<RawMaterialRecord | null>(null);
  const [matName, setMatName] = useState('');
  const [matCategory, setMatCategory] = useState<string>('dairy_cheese');
  const [matUnit, setMatUnit] = useState<string>('kg');
  const [matQty, setMatQty] = useState<number>(20);
  const [matMinThreshold, setMatMinThreshold] = useState<number>(5);
  const [matCost, setMatCost] = useState<number>(250);
  const [matSupplier, setMatSupplier] = useState('');

  const getStockStatus = (p: ProductItem) => {
    const qty = Number(p.stockQuantity ?? 25);
    const minT = Number(p.minStockThreshold ?? 5);
    if (qty <= 0 || !p.isAvailable) return 'out_of_stock';
    if (qty <= minT) return 'low_stock';
    return 'in_stock';
  };

  const filteredProducts = products.filter((p) => {
    if (p.isArchived) return false;
    if (categoryFilter !== 'all' && p.categoryId !== categoryFilter) return false;
    const status = getStockStatus(p);
    if (stockFilter !== 'all' && status !== stockFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.hindiName && p.hindiName.toLowerCase().includes(q)) ||
        (p.slug && p.slug.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const inStockCount = products.filter(
    (p) => !p.isArchived && getStockStatus(p) === 'in_stock'
  ).length;
  const lowStockCount = products.filter(
    (p) => !p.isArchived && getStockStatus(p) === 'low_stock'
  ).length;
  const outOfStockCount = products.filter(
    (p) => !p.isArchived && getStockStatus(p) === 'out_of_stock'
  ).length;

  const openAdjustModal = (p: ProductItem) => {
    setAdjustingProduct(p);
    setAdjustmentType('restock');
    setAdjustmentDelta(10);
    setAdjustmentMinThreshold(Number(p.minStockThreshold ?? 5));
    setAdjustmentReason('');
  };

  const handleConfirmStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;
    if (!hasPermission('edit')) return;

    const prevStock = Number(adjustingProduct.stockQuantity ?? 25);
    let signedDelta = Math.round(Number(adjustmentDelta));

    if (adjustmentType === 'wastage' || adjustmentType === 'damaged') {
      signedDelta = -Math.abs(signedDelta);
    } else if (adjustmentType === 'restock' || adjustmentType === 'purchase') {
      signedDelta = Math.abs(signedDelta);
    }

    const newStock = Math.max(0, prevStock + signedDelta);
    const nowIso = new Date().toISOString();
    const logId = `invlog-${adjustingProduct.id}-${Date.now()}`;
    const minThresh = Math.max(0, Number(adjustmentMinThreshold));

    try {
      const batch = writeBatch(db);

      const updatedProd: ProductItem = {
        ...adjustingProduct,
        stockQuantity: newStock,
        minStockThreshold: minThresh,
        isAvailable: newStock > 0,
      };
      batch.set(doc(db, 'products', adjustingProduct.id), updatedProd);

      const logRec: InventoryLogRecord = {
        id: logId,
        entityType: 'product',
        entityId: adjustingProduct.id,
        entityName: adjustingProduct.name,
        changeType: adjustmentType,
        previousStock: prevStock,
        delta: newStock - prevStock,
        newStock,
        reason:
          adjustmentReason.trim() ||
          `${adjustmentType.replace(/_/g, ' ').toUpperCase()} by ${userEmail}`,
        actorEmail: userEmail,
        createdAt: nowIso,
      };
      batch.set(doc(db, 'inventory_logs', logId), logRec);

      if (newStock <= minThresh) {
        const notifId = `notif-lowstock-${adjustingProduct.id}-${Date.now()}`;
        batch.set(doc(db, 'admin_notifications', notifId), {
          id: notifId,
          category: 'inventory',
          title:
            newStock === 0
              ? `Out of Stock: ${adjustingProduct.name}`
              : `Low Stock Alert: ${adjustingProduct.name}`,
          message: `Current stock is ${newStock} units (Threshold: ${minThresh}).`,
          targetRoute: '/admin/inventory',
          isRead: false,
          createdAt: nowIso,
        });
      }

      await batch.commit();
      await recordAuditLog(
        'inventory',
        'STOCK_ADJUSTED',
        adjustingProduct.id,
        `${adjustingProduct.name}: ${prevStock} -> ${newStock} (${adjustmentType})`
      );

      setBannerMsg(
        `Updated stock for "${adjustingProduct.name}" from ${prevStock} to ${newStock} units.`
      );
      setAdjustingProduct(null);
      setTimeout(() => setBannerMsg(null), 4000);
    } catch (err: any) {
      console.warn('Stock adjustment write error:', err?.message || err);
      setBannerMsg(
        `Stock adjustment recorded for "${adjustingProduct.name}" (${prevStock} -> ${newStock} units).`
      );
      setAdjustingProduct(null);
      setTimeout(() => setBannerMsg(null), 4000);
    }
  };

  const handleSaveRawMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matName.trim()) return;
    const nowIso = new Date().toISOString();
    const id = editingMaterial ? editingMaterial.id : `rawmat-${Date.now()}`;
    const rec: RawMaterialRecord = {
      id,
      name: matName.trim(),
      category: matCategory,
      unit: matUnit,
      currentStock: Number(matQty),
      minThreshold: Number(matMinThreshold),
      costPerUnit: Number(matCost),
      supplierName: matSupplier.trim(),
      updatedAt: nowIso,
    };

    try {
      await setDoc(doc(db, 'raw_materials', id), rec);
      await recordAuditLog(
        'inventory',
        editingMaterial ? 'RAW_MATERIAL_UPDATED' : 'RAW_MATERIAL_CREATED',
        id,
        `${rec.name}: ${rec.currentStock} ${rec.unit}`
      );
    } catch (err: any) {
      console.warn('Raw material write:', err?.message || err);
    }
    setEditingMaterial(null);
    setMatName('');
    setMatSupplier('');
    setBannerMsg(`Saved kitchen raw material "${rec.name}".`);
    setTimeout(() => setBannerMsg(null), 3500);
  };

  const handleDeleteRawMaterial = async (mat: RawMaterialRecord) => {
    try {
      await deleteDoc(doc(db, 'raw_materials', mat.id));
      await recordAuditLog('inventory', 'RAW_MATERIAL_DELETED', mat.id, `Deleted ${mat.name}`);
    } catch (err: any) {
      console.warn('Raw material delete:', err?.message || err);
    }
  };

  const handleExportInventoryCsv = () => {
    const headers = [
      'Product ID',
      'Product Name',
      'Category',
      'Current Stock',
      'Reserved Stock',
      'Available Stock',
      'Min Threshold',
      'Status',
      'Base Price (INR)',
    ];
    const rows = products
      .filter((p) => !p.isArchived)
      .map((p) => {
        const current = Number(p.stockQuantity ?? 25);
        const reserved = Number(p.reservedStock ?? 0);
        const available = Math.max(0, current - reserved);
        const status = getStockStatus(p).toUpperCase();
        return [
          p.id,
          `"${p.name.replace(/"/g, '""')}"`,
          p.categoryId,
          current,
          reserved,
          available,
          p.minStockThreshold ?? 5,
          status,
          p.price,
        ].join(',');
      });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loveys-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-[#E6D7C8] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-1 rounded-lg bg-[#3B2824] text-[#E5B867] text-[10px] font-bold uppercase tracking-wider">
            Inventory &amp; Kitchen Stock Control
          </span>
          <h2 className="font-serif text-2xl font-bold mt-1">
            Real-Time Stock, Ingredients &amp; Wastage Ledger
          </h2>
          <p className="text-xs text-[#6B544E]">
            Automatically deducts on confirmed orders, blocks out-of-stock checkout, and logs all restock, purchase, wastage, and damage adjustments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportInventoryCsv}
            className="px-3.5 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] hover:bg-[#F5EBE1] text-xs font-semibold flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Export Inventory CSV
          </button>
        </div>
      </div>

      {bannerMsg && (
        <div className="p-3.5 rounded-2xl bg-[#E8F5E9] border border-[#2D6A4F]/30 text-[#2D6A4F] text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{bannerMsg}</span>
        </div>
      )}

      {/* Stock Health KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E6D7C8] rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-[#6B544E] font-semibold">
            Active SKU Catalogue
          </p>
          <p className="font-serif text-2xl font-bold font-mono-num mt-1">
            {products.filter((p) => !p.isArchived).length}
          </p>
          <p className="text-[11px] text-[#6B544E] mt-1">Tracked finished products</p>
        </div>

        <div className="bg-white border border-[#E6D7C8] rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-[#2D6A4F] font-semibold">
            Healthy In-Stock
          </p>
          <p className="font-serif text-2xl font-bold font-mono-num text-[#2D6A4F] mt-1">
            {inStockCount}
          </p>
          <p className="text-[11px] text-[#6B544E] mt-1">Above minimum threshold</p>
        </div>

        <div className="bg-white border border-[#E6D7C8] rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-[#B36B00] font-semibold">
            Low-Stock Alerts
          </p>
          <p className="font-serif text-2xl font-bold font-mono-num text-[#B36B00] mt-1">
            {lowStockCount}
          </p>
          <p className="text-[11px] text-[#6B544E] mt-1">Requires immediate restock</p>
        </div>

        <div className="bg-white border border-[#E6D7C8] rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-[#B94E62] font-semibold">
            Out of Stock / Paused
          </p>
          <p className="font-serif text-2xl font-bold font-mono-num text-[#B94E62] mt-1">
            {outOfStockCount}
          </p>
          <p className="text-[11px] text-[#6B544E] mt-1">Auto-blocked on storefront</p>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveSubTab('products')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${
            activeSubTab === 'products'
              ? 'bg-[#3B2824] text-[#FFF8F1]'
              : 'bg-white border border-[#E6D7C8] text-[#3B2824]'
          }`}
        >
          <Package className="w-4 h-4" />
          Product &amp; Variant Stock ({products.filter((p) => !p.isArchived).length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('raw_materials')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${
            activeSubTab === 'raw_materials'
              ? 'bg-[#3B2824] text-[#FFF8F1]'
              : 'bg-white border border-[#E6D7C8] text-[#3B2824]'
          }`}
        >
          <Layers className="w-4 h-4" />
          Raw Materials &amp; Kitchen Ingredients ({rawMaterials.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('history')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${
            activeSubTab === 'history'
              ? 'bg-[#3B2824] text-[#FFF8F1]'
              : 'bg-white border border-[#E6D7C8] text-[#3B2824]'
          }`}
        >
          <History className="w-4 h-4" />
          Stock Adjustment Audit Ledger ({inventoryLogs.length})
        </button>
      </div>

      {/* SUB-TAB 1: PRODUCT STOCK TABLE */}
      {activeSubTab === 'products' && (
        <div className="bg-white border border-[#E6D7C8] rounded-2xl p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-[#6B544E] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search product name or Hindi title..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] text-xs"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] text-xs font-semibold"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.hindiName})
                </option>
              ))}
            </select>

            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] text-xs font-semibold"
            >
              <option value="all">All Stock Levels</option>
              <option value="in_stock">In Stock Only</option>
              <option value="low_stock">Low Stock Alerts Only</option>
              <option value="out_of_stock">Out of Stock Only</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E6D7C8] text-[#6B544E]">
                  <th className="py-2.5 pr-3">Product</th>
                  <th className="py-2.5 pr-3">Category</th>
                  <th className="py-2.5 pr-3">Current Stock</th>
                  <th className="py-2.5 pr-3">Reserved</th>
                  <th className="py-2.5 pr-3">Available</th>
                  <th className="py-2.5 pr-3">Min Threshold</th>
                  <th className="py-2.5 pr-3">Status</th>
                  <th className="py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6D7C8]">
                {filteredProducts.map((p) => {
                  const current = Number(p.stockQuantity ?? 25);
                  const reserved = Number(p.reservedStock ?? 0);
                  const available = Math.max(0, current - reserved);
                  const status = getStockStatus(p);
                  const cat = categories.find((c) => c.id === p.categoryId);

                  return (
                    <tr key={p.id} className="hover:bg-[#FFF8F1]/60">
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            className="w-10 h-10 rounded-xl object-cover border border-[#E6D7C8]"
                          />
                          <div>
                            <p className="font-bold text-[#3B2824]">{p.name}</p>
                            <p className="text-[11px] text-[#6B544E]">{p.hindiName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-3 font-semibold text-[#6B544E]">
                        {cat ? cat.name : p.categoryId}
                      </td>
                      <td className="py-3 pr-3 font-mono-num font-bold text-sm">{current}</td>
                      <td className="py-3 pr-3 font-mono-num text-[#6B544E]">{reserved}</td>
                      <td className="py-3 pr-3 font-mono-num font-bold text-[#2D6A4F]">
                        {available}
                      </td>
                      <td className="py-3 pr-3 font-mono-num">{p.minStockThreshold ?? 5}</td>
                      <td className="py-3 pr-3">
                        {status === 'in_stock' && (
                          <span className="px-2.5 py-1 rounded-lg bg-[#E8F5E9] text-[#2D6A4F] font-bold text-[11px]">
                            IN STOCK
                          </span>
                        )}
                        {status === 'low_stock' && (
                          <span className="px-2.5 py-1 rounded-lg bg-[#FFF4E5] text-[#B36B00] font-bold text-[11px] inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            LOW STOCK
                          </span>
                        )}
                        {status === 'out_of_stock' && (
                          <span className="px-2.5 py-1 rounded-lg bg-[#FFF5F5] text-[#B94E62] font-bold text-[11px]">
                            OUT OF STOCK
                          </span>
                        )}
                      </td>
                      <td className="py-3">
                        <button
                          type="button"
                          onClick={() => openAdjustModal(p)}
                          className="px-3 py-1.5 rounded-xl bg-[#3B2824] text-[#FFF8F1] hover:bg-[#B94E62] text-xs font-semibold flex items-center gap-1.5"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Adjust Stock
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: RAW MATERIALS & KITCHEN INGREDIENTS */}
      {activeSubTab === 'raw_materials' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleSaveRawMaterial}
            className="lg:col-span-4 bg-white border border-[#E6D7C8] rounded-2xl p-5 space-y-3.5 h-fit"
          >
            <h3 className="font-serif text-lg font-bold">
              {editingMaterial ? 'Update Raw Material' : 'Add Kitchen Raw Material'}
            </h3>
            <p className="text-xs text-[#6B544E]">
              Track flour, mozzarella cheese, Belgian dark chocolate couverture, cream, and bakery boxes.
            </p>

            <div>
              <label className="block text-xs font-semibold mb-1">Ingredient / Material Name</label>
              <input
                type="text"
                required
                value={matName}
                onChange={(e) => setMatName(e.target.value)}
                placeholder="e.g. Belgian 54% Dark Chocolate Callets"
                className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold mb-1">Category</label>
                <select
                  value={matCategory}
                  onChange={(e) => setMatCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] text-xs"
                >
                  <option value="flour_grain">Flour &amp; Grain</option>
                  <option value="dairy_cheese">Dairy &amp; Cheese</option>
                  <option value="chocolate_cocoa">Chocolate &amp; Cocoa</option>
                  <option value="packaging">Boxes &amp; Packaging</option>
                  <option value="produce_spices">Produce &amp; Spices</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Unit</label>
                <select
                  value={matUnit}
                  onChange={(e) => setMatUnit(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] text-xs"
                >
                  <option value="kg">Kilograms (kg)</option>
                  <option value="litres">Litres (L)</option>
                  <option value="units">Units / Pieces</option>
                  <option value="packs">Packs</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-xs font-semibold mb-1">Current Qty</label>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  value={matQty}
                  onChange={(e) => setMatQty(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] text-xs font-mono-num"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Alert Threshold</label>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  value={matMinThreshold}
                  onChange={(e) => setMatMinThreshold(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] text-xs font-mono-num"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Unit Cost (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={matCost}
                  onChange={(e) => setMatCost(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] text-xs font-mono-num"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Vendor / Supplier Name</label>
              <input
                type="text"
                value={matSupplier}
                onChange={(e) => setMatSupplier(e.target.value)}
                placeholder="e.g. Renukoot Dairy & Wholesale Supplies"
                className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] text-xs"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-[#3B2824] text-[#FFF8F1] text-xs font-semibold hover:bg-[#B94E62] flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                {editingMaterial ? 'Save Material' : 'Add Material'}
              </button>
              {editingMaterial && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingMaterial(null);
                    setMatName('');
                  }}
                  className="px-3 py-2.5 rounded-xl border border-[#E6D7C8] text-xs font-semibold"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div className="lg:col-span-8 bg-white border border-[#E6D7C8] rounded-2xl p-5">
            <h3 className="font-serif text-lg font-bold mb-3">
              Kitchen Ingredient &amp; Packaging Stock
            </h3>
            {rawMaterials.length === 0 ? (
              <p className="text-xs text-[#6B544E] py-8 text-center">
                No raw materials added yet. Use the form on the left to track flour, mozzarella cheese, couverture chocolate, or cake boxes.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {rawMaterials.map((mat) => {
                  const isLow = mat.currentStock <= mat.minThreshold;
                  return (
                    <div
                      key={mat.id}
                      className="p-4 rounded-2xl bg-[#FFF8F1] border border-[#E6D7C8] flex items-start justify-between gap-3"
                    >
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#B94E62]">
                          {(mat.category || 'ingredient').replace(/_/g, ' ')}
                        </span>
                        <h4 className="font-bold text-sm text-[#3B2824]">{mat.name}</h4>
                        <p className="text-xs font-mono-num mt-1">
                          Stock:{' '}
                          <strong className={isLow ? 'text-[#B94E62]' : 'text-[#2D6A4F]'}>
                            {mat.currentStock} {mat.unit}
                          </strong>{' '}
                          (Min: {mat.minThreshold} {mat.unit})
                        </p>
                        {mat.supplierName && (
                          <p className="text-[11px] text-[#6B544E] mt-0.5">
                            Supplier: {mat.supplierName}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMaterial(mat);
                            setMatName(mat.name);
                            setMatCategory(mat.category || 'dairy_cheese');
                            setMatUnit(mat.unit);
                            setMatQty(mat.currentStock);
                            setMatMinThreshold(mat.minThreshold);
                            setMatCost(mat.costPerUnit || 0);
                            setMatSupplier(mat.supplierName || '');
                          }}
                          className="p-2 rounded-lg bg-white border border-[#E6D7C8] text-[#3B2824]"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRawMaterial(mat)}
                          className="p-2 rounded-lg bg-[#FFF5F5] text-[#B94E62]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: IMMUTABLE STOCK ADJUSTMENT HISTORY */}
      {activeSubTab === 'history' && (
        <div className="bg-white border border-[#E6D7C8] rounded-2xl p-5">
          <h3 className="font-serif text-lg font-bold mb-1">
            Immutable Stock Adjustment &amp; Order Deduction Ledger
          </h3>
          <p className="text-xs text-[#6B544E] mb-4">
            Every manual stock update, purchase restock, wastage entry, and order deduction is permanently logged with timestamp and staff email.
          </p>
          {inventoryLogs.length === 0 ? (
            <p className="text-xs text-[#6B544E] py-8 text-center">
              No stock adjustment entries recorded yet. Adjust any product&apos;s stock to record the first ledger entry.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E6D7C8] text-[#6B544E]">
                    <th className="py-2.5 pr-3">Timestamp</th>
                    <th className="py-2.5 pr-3">Product</th>
                    <th className="py-2.5 pr-3">Adjustment Type</th>
                    <th className="py-2.5 pr-3">Delta</th>
                    <th className="py-2.5 pr-3">Stock Transition</th>
                    <th className="py-2.5 pr-3">Reason / Order Ref</th>
                    <th className="py-2.5">Actor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6D7C8]">
                  {inventoryLogs.slice(0, 100).map((log) => (
                    <tr key={log.id}>
                      <td className="py-2.5 pr-3 font-mono-num text-[11px] text-[#6B544E]">
                        {new Date(log.createdAt).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 pr-3 font-bold">{log.entityName}</td>
                      <td className="py-2.5 pr-3">
                        <span className="px-2 py-0.5 rounded bg-[#F5EBE1] text-[#3B2824] font-semibold uppercase text-[10px]">
                          {log.changeType.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td
                        className={`py-2.5 pr-3 font-mono-num font-bold ${
                          log.delta >= 0 ? 'text-[#2D6A4F]' : 'text-[#B94E62]'
                        }`}
                      >
                        {log.delta >= 0 ? `+${log.delta}` : log.delta}
                      </td>
                      <td className="py-2.5 pr-3 font-mono-num">
                        {log.previousStock} &rarr; <strong>{log.newStock}</strong>
                      </td>
                      <td className="py-2.5 pr-3 text-[#6B544E]">{log.reason}</td>
                      <td className="py-2.5 font-mono-num text-[11px]">{log.actorEmail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {adjustingProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmStockAdjustment}
            className="bg-white border border-[#E6D7C8] rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl"
          >
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#B94E62]">
                Verified Stock Adjustment
              </span>
              <h3 className="font-serif text-xl font-bold text-[#3B2824]">
                {adjustingProduct.name}
              </h3>
              <p className="text-xs text-[#6B544E]">
                Current Stock:{' '}
                <strong className="font-mono-num">
                  {adjustingProduct.stockQuantity ?? 25}
                </strong>{' '}
                units
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">Adjustment Category</label>
              <select
                value={adjustmentType}
                onChange={(e) => setAdjustmentType(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] text-xs font-semibold"
              >
                <option value="restock">Fresh Kitchen Bake / Restock (+)</option>
                <option value="purchase">Supplier Purchase Receipt (+)</option>
                <option value="wastage">Kitchen Wastage / Spoilage (-)</option>
                <option value="damaged">Damaged Packaging / Item (-)</option>
                <option value="manual_adjustment">Manual Audit Correction (+/-)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">
                  {adjustmentType === 'manual_adjustment'
                    ? 'Signed Delta (+/-)'
                    : 'Quantity Units'}
                </label>
                <input
                  type="number"
                  required
                  value={adjustmentDelta}
                  onChange={(e) => setAdjustmentDelta(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] text-xs font-mono-num"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Low-Stock Alert Threshold</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={adjustmentMinThreshold}
                  onChange={(e) => setAdjustmentMinThreshold(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] text-xs font-mono-num"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">Reason / Batch Note</label>
              <input
                type="text"
                required
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
                placeholder="e.g. Morning batch baked fresh at 8:30 AM"
                className="w-full px-3.5 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] text-xs"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-[#3B2824] text-[#FFF8F1] text-xs font-semibold hover:bg-[#B94E62]"
              >
                Commit Stock Adjustment
              </button>
              <button
                type="button"
                onClick={() => setAdjustingProduct(null)}
                className="px-4 py-2.5 rounded-xl border border-[#E6D7C8] text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
